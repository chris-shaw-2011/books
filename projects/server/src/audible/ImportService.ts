import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Mutex } from "async-mutex"
import sanitize from "sanitize-filename"
import { AudibleImportBook, Directory, seriesBookTitle, type Book, type AudibleImportSnapshot, type SeriesOrganization, type BookSeries } from "@books/shared"
import { seriesDestination } from "../SeriesOrganization.ts"
import { readAudioMetadata, writeAudioMetadata } from "../AudioMetadata.ts"
import { audioFiles, publishAudio, writeAsin } from "./Files.ts"
import DownloadProgress from "./DownloadProgress.ts"
import selectionItems from "./SelectionItems.ts"

export function parseSeries(book: Record<string, unknown>): BookSeries[] {
	// Libation's ExportDto formats SeriesOrder as "1 : Name, 2 : Other name".
	const value = book.SeriesOrder
	if (typeof value !== "string" || !value.trim()) return []
	return value.split(/,\s*(?=[\d.-]+\s*:)/).flatMap(entry => {
		const match = /^\s*([^:]*?)\s*:\s*(.+?)\s*$/.exec(entry)
		if (!match) return []
		const text = match[1]?.trim()
		const order = Number(text)
		return [{ name: match[2] ?? "", order: text && Number.isFinite(order) && order >= 0 ? order : undefined }]
	})
}

export const qualitySettings = {
	FileDownloadQuality: "High",
	UseWidevine: true,
	Request_xHE_AAC: true,
	DecryptToLossy: false,
	SplitFilesByChapter: false,
	ImportPlusTitles: true,
}

const coverUrl = (value: unknown) => {
	if (typeof value !== "string") return
	try {
		const url = new URL(value)
		if (url.protocol === "https:" && !url.username && !url.password) return url.href
	}
	catch { /* Missing or malformed covers are optional. */ }
}

const text = (value: unknown) => typeof value === "string" ? value : ""

const coverFromId = (value: unknown) => {
	// Libation ExportDto exposes PictureId/PictureLarge; PictureStorage uses this CDN.
	if (typeof value === "string" && /^[a-zA-Z0-9+_-]{1,200}$/.test(value)) return `https://images-na.ssl-images-amazon.com/images/I/${encodeURIComponent(value)}._SL300_.jpg`
}

export function parseLibrary(json: unknown) {
	const list = Array.isArray(json) ? json : json && typeof json === "object" ? Object.values(json).find(Array.isArray) : undefined
	if (!Array.isArray(list)) throw new Error("Invalid Libation library export")
	const result = new Map<string, AudibleImportBook>()
	for (const entry of list) {
		if (!entry || typeof entry !== "object") continue
		const row = entry as Record<string, unknown>
		const nested = row.Book ?? row.book
		const book = nested && typeof nested === "object" ? nested as Record<string, unknown> : row
		const asin = book.asin ?? book.Asin ?? book.ASIN ?? book.AudibleProductId ?? book.ProductId
		const title = book.title ?? book.Title
		const series = parseSeries(book)
		const year = new Date(text(book.DatePublished)).getUTCFullYear()
		const image = coverUrl(book.PictureUrl ?? book.pictureUrl ?? book.CoverUrl ?? book.coverUrl ?? book.cover_url ?? book.ImageUrl ?? book.PictureLarge ?? book.PictureId) ?? coverFromId(book.PictureId) ?? coverFromId(book.PictureLarge)
		const contentType = book.content_type ?? book.ContentType ?? book.contentType
		const type = typeof contentType === "string" ? contentType.toLowerCase() : ""
		if (typeof asin === "string" && asin && typeof title === "string" && !type.includes("podcast") && !type.includes("episode")) result.set(asin, new AudibleImportBook({
			asin,
			name: title,
			cover: image ?? "",
			author: text(book.AuthorNames),
			narrator: text(book.NarratorNames),
			comment: text(book.Description),
			genre: text(book.CategoriesNames),
			year: Number.isFinite(year) ? year : 0,
			duration: typeof book.LengthInMinutes === "number" && Number.isFinite(book.LengthInMinutes) && book.LengthInMinutes > 0 ? book.LengthInMinutes * 60 : 0,
			series: series.length === 1 ? series[0]?.name ?? "" : "",
			seriesOrder: series.length === 1 ? series[0]?.order : undefined,
			seriesOptions: series.length > 1 ? series : [],
		}))
	}
	return [...result.values()]
}

export interface AudibleProcess {
	write(data: string): void,
	kill(): void,
	onData(callback: (data: string) => void): void,
	onExit(callback: (code: number) => void): void,
}

export interface AudibleDependencies {
	library?(): Promise<Directory>,
	spawn(args: string[], directory: string): Promise<AudibleProcess>,
	validate(file: string): Promise<void>,
	hasAsin(asin: string): Promise<boolean>,
	publish(file: string, book: AudibleImportBook): Promise<Book>,
}

interface Session {
	owner: string,
	directory: string,
	snapshot: Omit<AudibleImportSnapshot, "books"> & { books: AudibleImportBook[] },
	library: Directory,
	process?: AudibleProcess,
	cancelled: boolean,
	redirectSubmitted: boolean,
	run: Promise<void>,
	selection?: string[],
	resolveSelection?: () => void,
}

const terminal = (snapshot: AudibleImportSnapshot) => ["complete", "cancelled", "failed"].includes(snapshot.phase)
const loginHost = /^(?:www\.)?(?:amazon|audible)\.(?:com|co\.uk|de|fr|it|es|co\.jp|ca|com\.au|in|com\.br|com\.mx)$/

export function safeAmazonUrl(value: string) {
	try {
		const url = new URL(value)
		return url.protocol === "https:" && loginHost.test(url.hostname) && !url.username && !url.password && !/[\r\n\0]/.test(value)
	}
	catch {
		return false
	}
}

// Cancellation changes asynchronously while process operations are awaited.
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
export class AudibleImportService {
	private sessions = new Map<string, Session>()
	private listeners = new Map<string, Set<(snapshot: AudibleImportSnapshot) => void>>()
	private downloadMutex = new Mutex()
	private startMutex = new Mutex()
	private root: string
	private initialized: Promise<void>
	private dependencies: AudibleDependencies
	private selectionTimeoutMs: number
	constructor(dependencies: AudibleDependencies, root = path.join(os.tmpdir(), "books-audible-import"), selectionTimeoutMs = 30 * 60_000) {
		this.dependencies = dependencies
		this.selectionTimeoutMs = selectionTimeoutMs
		this.root = root
		this.initialized = this.initialize()
	}

	private async initialize() {
		await fs.rm(this.root, {
			recursive: true,
			force: true,
		})
		await fs.mkdir(this.root, {
			recursive: true,
			mode: 0o700,
		})
	}

	private emit(session: Session, message?: string) {
		if (message) session.snapshot.activity = [...session.snapshot.activity.slice(-199), message]
		const snapshot = this.snapshot(session.owner, false)
		if (snapshot) for (const listener of this.listeners.get(session.owner) ?? []) listener(snapshot)
	}

	snapshot(owner: string, includeLogin = true): AudibleImportSnapshot | undefined {
		const session = this.sessions.get(owner)
		if (!session) return
		const snapshot = { ...session.snapshot, books: session.snapshot.phase === "selecting" ? selectionItems(session.snapshot.books, session.library) : session.snapshot.books.map(book => new AudibleImportBook(book)), activity: [...session.snapshot.activity] }
		if (!includeLogin) delete snapshot.loginUrl
		return snapshot
	}

	subscribe(owner: string, callback: (snapshot: AudibleImportSnapshot) => void) {
		const listeners = this.listeners.get(owner) ?? new Set()
		listeners.add(callback)
		this.listeners.set(owner, listeners)
		const snapshot = this.snapshot(owner, false)
		if (snapshot) callback(snapshot)
		return () => {
			listeners.delete(callback)
			if (!listeners.size) this.listeners.delete(owner)
		}
	}

	private owned(owner: string, id: string) {
		const session = this.sessions.get(owner)
		if (session?.snapshot.id !== id) throw new Error("Import session not found")
		return session
	}

	async start(owner: string, account: string, marketplace: string) {
		return this.startMutex.runExclusive(() => this.startSession(owner, account, marketplace))
	}

	private async startSession(owner: string, account: string, marketplace: string) {
		await this.initialized
		if (typeof account !== "string" || !account.trim() || account.length > 254 || /[\r\n\0]/.test(account)) throw new Error("Enter a valid Audible account identifier")
		if (!["us", "uk", "de", "fr", "it", "es", "jp", "ca", "au", "in", "br", "mx"].includes(marketplace)) throw new Error("Unsupported Audible marketplace")
		const previous = this.sessions.get(owner)
		if (previous && (!terminal(previous.snapshot) || previous.snapshot.books.some(book => book.importStatus === "complete" && !book.reviewed))) throw new Error("An import or completed review queue already exists")
		if ([...this.sessions.values()].filter(session => !terminal(session.snapshot)).length >= 3) throw new Error("Audible import is busy; try again later")
		const id = randomUUID()
		const directory = await fs.mkdtemp(path.join(this.root, "session-"))
		await fs.mkdir(path.join(directory, "audio"))
		await fs.writeFile(path.join(directory, "Settings.json"), JSON.stringify({
			...qualitySettings,
			Books: path.join(directory, "audio"),
			InProgress: path.join(directory, "inprogress"),
			Serilog: {
				MinimumLevel: "Fatal",
				WriteTo: [{
					Name: "File",
					Args: { path: path.join(directory, "libation.log") },
				}],
			},
		}), {
			mode: 0o600,
		})
		const session: Session = {
			library: await this.dependencies.library?.() ?? new Directory(),
			owner,
			directory,
			cancelled: false,
			redirectSubmitted: false,
			run: Promise.resolve(),
			snapshot: {
				id,
				phase: "authenticating",
				operation: "Waiting for Amazon authentication",
				currentTitle: "",
				total: 0,
				skipped: 0,
				downloaded: 0,
				failed: 0,
				remaining: 0,
				books: [],
				activity: [],
			},
		}
		this.sessions.set(owner, session)
		session.run = this.run(session, account.trim(), marketplace)
		return this.snapshot(owner)
	}

	redirect(owner: string, id: string, redirectUrl: string) {
		const session = this.owned(owner, id)
		if (typeof redirectUrl !== "string" || redirectUrl.length > 16000 || !safeAmazonUrl(redirectUrl)) throw new Error("Paste the complete Amazon redirect URL")
		const parsed = new URL(redirectUrl)
		if (parsed.pathname !== "/ap/maplanding" || !parsed.searchParams.get("openid.oa2.authorization_code")) throw new Error("The URL does not contain an Amazon authorization code")
		if (session.snapshot.phase !== "authenticating" || !session.process || !session.snapshot.loginUrl || session.redirectSubmitted) throw new Error("This import is not waiting for authentication")
		session.redirectSubmitted = true
		// Only PTY input, never argv, logs or activity messages.
		session.process.write(`${redirectUrl}\r`)
		delete session.snapshot.loginUrl
		this.emit(session, "Amazon authentication submitted")
		return this.snapshot(owner)
	}

	select(owner: string, id: string, asins: string[], organizations: Record<string, SeriesOrganization> = {}) {
		const session = this.owned(owner, id)
		const selected = [...asins].sort()
		// A transport retry must never start the same downloads twice.
		if (session.selection && ["downloading", "complete"].includes(session.snapshot.phase) && JSON.stringify(selected) === JSON.stringify(session.selection)) return this.snapshot(owner)
		if (session.snapshot.phase !== "selecting") throw new Error("This import is not waiting for a selection")
		if (selected.some(asin => !session.snapshot.books.some(book => book.asin === asin && book.importStatus === "available"))) throw new Error("Select only available Audible books")
		const plans = new Map(Object.entries(organizations))
		for (const [asin, organization] of plans) {
			const book = session.snapshot.books.find(book => book.asin === asin)
			if (!selected.includes(asin) || !book?.seriesChoices.some(series => series.name === organization.series.name)) throw new Error("Choose a series from the selected book")
		}
		session.selection = selected
		for (const book of session.snapshot.books) {
			if (selected.includes(book.asin)) {
				book.importStatus = "queued"
				const organization = plans.get(book.asin)
				if (organization) {
					book.folderPath = organization.folderPath
					book.series = organization.series.name
					book.seriesOrder = organization.series.order
					book.padding = organization.padding
					book.seriesOptions = []
				}
			}
		}
		session.snapshot.remaining = selected.length
		session.snapshot.phase = "downloading"
		session.snapshot.operation = "Waiting to download selected books"
		session.resolveSelection?.()
		this.emit(session, `${selected.length} books selected for import`)
		return this.snapshot(owner)
	}

	async cancel(owner: string, id: string) {
		const session = this.owned(owner, id)
		if (!terminal(session.snapshot)) {
			session.cancelled = true
			session.process?.kill()
			session.resolveSelection?.()
			await session.run
		}
		return this.snapshot(owner)
	}

	review(owner: string, id: string, asin: string) {
		const session = this.owned(owner, id)
		const row = session.snapshot.books.find(book => book.asin === asin && book.importStatus === "complete")
		if (row) row.reviewed = true
		this.emit(session)
		return this.snapshot(owner)
	}

	async shutdown() {
		for (const session of this.sessions.values()) {
			session.cancelled = true
			session.process?.kill()
			session.resolveSelection?.()
		}
		await Promise.all([...this.sessions.values()].map(session => session.run))
		this.listeners.clear()
		await fs.rm(this.root, {
			recursive: true,
			force: true,
		})
	}

	private async command(session: Session, args: string[], login = false) {
		if (session.cancelled) throw new Error("Cancelled")
		const child = await this.dependencies.spawn(args, session.directory)
		session.process = child
		await new Promise<void>((resolve, reject) => {
			let buffer = ""
			const progress = new DownloadProgress()
			const timer = setTimeout(() => {
				child.kill()
				reject(new Error("Operation timed out"))
			}, login ? 15 * 60_000 : 6 * 60 * 60_000)
			timer.unref()
			child.onData(data => {
				// Never publish terminal text: URLs, cookies and tokens can occur in any verb.
				if (login && !session.redirectSubmitted) {
					// Strip terminal escape sequences before reading only the login URL.
					// eslint-disable-next-line no-control-regex
					buffer = (buffer + data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")).slice(-32000)
					// eslint-disable-next-line no-control-regex
					const candidate = buffer.match(/https:\/\/[^\s<>"\x1b]+(?=[\r\n])/g)?.find(safeAmazonUrl)
					if (candidate && !session.snapshot.loginUrl) {
						session.snapshot.loginUrl = candidate
						this.emit(session, "Amazon sign-in link is ready")
					}
				}
				else if (!login) {
					const percentage = progress.update(data)
					if (percentage !== undefined && session.snapshot.phase === "downloading") {
						session.snapshot.percentage = percentage
						const book = session.snapshot.books.find(item => item.importStatus === "downloading")
						if (book) book.percentage = session.snapshot.percentage
						this.emit(session)
					}
				}
			})
			child.onExit(code => {
				clearTimeout(timer)
				delete session.process
				if (code === 0 && !session.cancelled) resolve()
				else reject(new Error("Libation operation failed"))
			})
			if (session.cancelled) child.kill()
		})
	}

	private async run(session: Session, account: string, marketplace: string) {
		let failed = false
		try {
			await this.command(session, ["login-external", "-a", account, "-l", marketplace], true)
			delete session.snapshot.loginUrl
			session.snapshot.phase = "scanning"
			session.snapshot.operation = "Scanning Audible library"
			this.emit(session, "Amazon authentication completed")
			await this.command(session, ["scan", "-o", "ImportPlusTitles=true"])
			const exported = path.join(session.directory, "library.json")
			await this.command(session, ["export", "-p", exported, "-j"])
			const titles = parseLibrary(JSON.parse(await fs.readFile(exported, "utf8")))
			session.snapshot.total = titles.length
			for (const title of titles) {
				if (session.cancelled) throw new Error("Cancelled")
				const exists = await this.dependencies.hasAsin(title.asin)
				title.importStatus = exists ? "skipped" : "available"
				session.snapshot.books.push(title)
				if (exists) session.snapshot.skipped++
			}
			if (session.cancelled) throw new Error("Cancelled")
			if (!session.snapshot.books.some(book => book.importStatus === "available")) return
			session.snapshot.phase = "selecting"
			session.snapshot.operation = "Choose the books to import"
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error("Selection expired")), this.selectionTimeoutMs)
				timer.unref()
				session.resolveSelection = () => {
					clearTimeout(timer)
					resolve()
				}
				this.emit(session, "Library ready. Select books before downloading; this session expires in 30 minutes.")
			})
			delete session.resolveSelection
			for (const title of session.snapshot.books.filter(book => book.importStatus === "queued")) {
				if (session.cancelled) break
				await this.downloadMutex.runExclusive(async () => {
					if (session.cancelled) return
					session.snapshot.currentTitle = title.name
					delete session.snapshot.percentage
					try {
						if (await this.dependencies.hasAsin(title.asin)) {
							session.snapshot.skipped++
							title.importStatus = "skipped"
							this.emit(session, `Skipped existing ASIN ${title.asin}`)
							return
						}
						title.importStatus = "downloading"
						session.snapshot.operation = "Downloading audiobook"
						this.emit(session, `Downloading ${title.name}`)
						await fs.rm(path.join(session.directory, "audio"), {
							recursive: true,
							force: true,
						})
						await fs.mkdir(path.join(session.directory, "audio"))
						const download = async (settings: typeof qualitySettings) => {
							title.percentage = undefined
							delete session.snapshot.percentage
							await fs.rm(path.join(session.directory, "audio"), { recursive: true, force: true })
							await fs.mkdir(path.join(session.directory, "audio"))
							const overrides = Object.entries(settings).flatMap(([key, value]) => ["-o", `${key}=${String(value)}`])
							await this.command(session, ["liberate", title.asin, ...overrides])
							const files = await audioFiles(path.join(session.directory, "audio"))
							if (files.length !== 1 || !files[0]) throw new Error("Expected one completed M4B")
							return files[0]
						}
						let completed: string
						try {
							completed = await download(qualitySettings)
						}
						catch {
							if (session.cancelled) throw new Error("Cancelled")
							this.emit(session, "Retrying with high-quality AAC")
							try {
								completed = await download({ ...qualitySettings, Request_xHE_AAC: false })
							}
							catch {
								if (session.cancelled) throw new Error("Cancelled")
								this.emit(session, "Retrying with compatible high-quality source")
								completed = await download({ ...qualitySettings, Request_xHE_AAC: false, UseWidevine: false })
							}
						}
						if (session.cancelled) throw new Error("Cancelled")
						session.snapshot.operation = "Validating audiobook"
						this.emit(session)
						await this.dependencies.validate(completed)
						if (session.cancelled) throw new Error("Cancelled")
						const book = await this.dependencies.publish(completed, title)
						session.snapshot.downloaded++
						title.importStatus = "complete"
						title.percentage = 100
						Object.assign(title, book)
						title.seriesOptions = []
						this.emit(session, `Imported ${title.name}`)
					}
					catch {
						if (!session.cancelled) {
							title.importStatus = "failed"
							title.percentage = undefined
							session.snapshot.failed++
							this.emit(session, `Could not import ${title.name}; try this title again in a new import`)
						}
					}
					finally {
						session.snapshot.remaining--
						this.emit(session)
					}
				})
			}
		}
		catch (error) {
			failed = true
			if (!session.cancelled && error instanceof Error && error.message === "Selection expired") session.snapshot.error = "Your book selection expired. Start a new import and sign in again."
			else if (!session.cancelled) session.snapshot.error = "Libation could not complete this operation. Check that Libation is installed, then start a new import and authenticate again."
		}
		finally {
			delete session.resolveSelection
			for (const book of session.snapshot.books) {
				if (book.importStatus === "queued" || book.importStatus === "downloading") {
					book.importStatus = session.cancelled ? "cancelled" : "failed"
					book.percentage = undefined
				}
			}
			session.snapshot.remaining = 0
			delete session.snapshot.loginUrl
			delete session.snapshot.percentage
			try {
				await fs.rm(session.directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
			}
			catch {
				failed = true
				if (!session.cancelled) session.snapshot.error = "Temporary Audible files could not be removed. Contact an administrator."
			}
			session.snapshot.phase = session.cancelled ? "cancelled" : failed ? "failed" : "complete"
			session.snapshot.operation = session.cancelled ? "Import cancelled" : failed ? "Import failed" : "Import complete"
			this.emit(session, session.snapshot.operation)
		}
	}
}
const defaultSpawn = async (args: string[], directory: string): Promise<AudibleProcess> => {
	const pty = await import("node-pty")
	const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !entry[0].startsWith("LIBATION_")))
	Object.assign(env, {
		LIBATION_FILES_DIR: directory,
		HOME: directory,
		XDG_CONFIG_HOME: directory,
		XDG_CACHE_HOME: directory,
		XDG_DATA_HOME: directory,
		TMPDIR: directory,
	})
	const child = pty.spawn(process.env.LIBATION_CLI ?? "libationcli", args, {
		name: "xterm",
		cols: 2000,
		rows: 40,
		cwd: directory,
		env,
	})
	return {
		write: data => child.write(data),
		kill: () => {
			try {
				process.kill(-child.pid, "SIGKILL")
			}
			catch {
				try {
					child.kill("SIGKILL")
				}
				catch { /* Process already exited. */ }
			}
		},
		onData: callback => {
			child.onData(callback)
		},
		onExit: callback => {
			child.onExit(event => callback(event.exitCode))
		},
	}
}
export const validateM4b = async (file: string) => {
	const {
		ffprobePath,
	} = await import("ffmpeg-ffprobe-static")
	const {
		stdout, stderr,
	} = await promisify(execFile)(process.env.FFPROBE_PATH ?? ffprobePath ?? "ffprobe", ["-v", "error", "-show_format", "-show_streams", "-show_chapters", "-count_packets", "-of", "json", file], {
		maxBuffer: 8 * 1024 * 1024,
	})
	const data = JSON.parse(stdout) as {
		format?: {
			duration?: string,
		},
		streams?: {
			codec_type?: string,
			codec_name?: string,
			nb_read_packets?: string,
		}[],
	}
	if (stderr.trim() || !(Number(data.format?.duration) > 0) || !data.streams?.some(stream => stream.codec_type === "audio" && Number(stream.nb_read_packets) > 0 && ["aac", "alac", "mp3", "opus", "flac"].includes(stream.codec_name ?? ""))) throw new Error("Unreadable or incomplete audio")
}
export const createAudibleImporter = (settings: () => {
	uploadLocation: string,
	baseBooksPath: string,
}, index: (file: string) => Promise<Book>, hasAsin: AudibleDependencies["hasAsin"], options: { spawn?: AudibleDependencies["spawn"], temporaryRoot?: string, library?: () => Promise<Directory> } = {}) => new AudibleImportService({
	spawn: options.spawn ?? defaultSpawn,
	library: options.library ?? (() => Promise.resolve(new Directory())),
	validate: validateM4b,
	hasAsin,
	publish: async (file, book) => {
		writeAsin(file, book.asin)
		const series = book.seriesChoices[0]
		const destination = book.folderPath ? await seriesDestination(settings().baseBooksPath, book.folderPath) : settings().uploadLocation
		const title = book.folderPath && book.seriesOrder !== undefined ? seriesBookTitle(book.name, book.seriesOrder, book.padding) : book.name
		const name = sanitize(title.replace(/:/g, " - ")).slice(0, 180) || book.asin
		if (series) {
			const metadata = readAudioMetadata(file)
			writeAudioMetadata(file, { ...metadata, series: series.name, seriesOrder: series.order, title: book.folderPath ? name : metadata.title })
		}
		await validateM4b(file)
		const target = await publishAudio(file, destination, name)
		try {
			return await index(target)
		}
		catch (error) {
			await fs.rm(target, { force: true })
			await fs.rm(`${target}.jpg`, { force: true })
			throw error
		}
	},
}, options.temporaryRoot)
