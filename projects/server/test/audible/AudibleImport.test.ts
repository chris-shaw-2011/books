/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-non-null-assertion -- Mock async dependencies and asserted fixture indexes. */
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Book } from "@books/shared"
import { AudibleImportService, parseLibrary, qualitySettings, safeAmazonUrl, type AudibleProcess } from "../../src/audible/ImportService.ts"
import { publishAudio } from "../../src/audible/Files.ts"
const loginUrl = "https://www.amazon.com/ap/signin?secret=never-stream-this"
const redirectUrl = "https://www.audible.com/ap/maplanding?openid.oa2.authorization_code=secret"
const waitFor = async (condition: () => boolean) => {
	for (let i = 0; i < 200; i++) {
		if (condition()) return
		await new Promise(resolve => setTimeout(resolve, 5))
	}
	throw new Error("Timed out waiting for import")
}
void test("parses pinned Libation JSON including purchased and Plus, excludes podcasts and uses ASIN only", () => {
	assert.deepEqual(parseLibrary([{
		AudibleProductId: "B000000001",
		Title: "Purchased",
		IsAudiblePlus: false,
		ContentType: "Product",
	}, {
		AudibleProductId: "B000000002",
		Title: "Plus",
		IsAudiblePlus: true,
	}, {
		AudibleProductId: "B000000003",
		Title: "Podcast",
		ContentType: "PodcastEpisode",
	}, {
		AudibleProductId: "",
		Title: "Purchased",
	}]), [{
		asin: "B000000001",
		title: "Purchased",
	}, {
		asin: "B000000002",
		title: "Plus",
	}])
	assert.throws(() => parseLibrary({
		unexpected: true,
	}))
	assert.equal(safeAmazonUrl("https://amazon.com.evil.example/ap/signin"), false)
	assert.equal(safeAmazonUrl("http://www.amazon.com/ap/signin"), false)
	assert.equal(safeAmazonUrl(loginUrl), true)
	assert.equal(safeAmazonUrl(redirectUrl), true)
})
void test("interactive login, progress, queue, partial failure, repeat duplicate detection and cleanup", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-test-"))
	const imported = new Set<string>()
	const commands: string[][] = []
	const events: unknown[] = []
	let loginInput = ""
	let sessionDirectory = ""
	const service = new AudibleImportService({
		spawn: async (args, directory) => {
			commands.push(args)
			sessionDirectory = directory
			let data: (value: string) => void = () => undefined
			let exit: (code: number) => void = () => undefined
			const child: AudibleProcess = {
				onData: callback => {
					data = callback
				},
				onExit: callback => {
					exit = callback
				},
				kill: () => {
					exit(1)
				},
				write: value => {
					loginInput = value
					setImmediate(() => exit(0))
				},
			}
			setImmediate(() => {
				void (async () => {
					if (args[0] === "login-external") {
						data(`${loginUrl}\r\n`)
						return
					}
					if (args[0] === "export") await fs.writeFile(args[2]!, JSON.stringify([{
						AudibleProductId: "B000000001",
						Title: "Already present",
					}, {
						AudibleProductId: "B000000002",
						Title: "Plus",
					}, {
						AudibleProductId: "B000000003",
						Title: "Bad download",
					}, {
						AudibleProductId: "B000000004",
						Title: "Last book",
					}]))
					if (args[0] === "liberate") {
						if (args[1] === "B000000003") {
							exit(1)
							return
						}
						await fs.writeFile(path.join(directory, "audio", "complete.m4b"), "mock completed audio")
						data(" 42% ")
					}
					exit(0)
				})()
			})
			return child
		},
		hasAsin: async asin => asin === "B000000001" || imported.has(asin),
		validate: async file => {
			assert.equal(await fs.readFile(file, "utf8"), "mock completed audio")
		},
		publish: async (_file, title) => {
			imported.add(title.asin)
			return new Book({
				id: title.asin,
				name: title.title,
				asin: title.asin,
			})
		},
	}, path.join(root, "sessions"))
	const unsubscribe = service.subscribe("user", snapshot => {
		events.push(snapshot)
	})
	try {
		const started = await service.start("user", "email@example.com", "us")
		assert.ok(started)
		await waitFor(() => Boolean(service.snapshot("user")?.loginUrl))
		assert.equal(service.snapshot("user")?.loginUrl, loginUrl)
		assert.equal(service.snapshot("another-user"), undefined)
		assert.throws(() => service.redirect("another-user", started.id, redirectUrl))
		assert.throws(() => service.redirect("user", started.id, "https://evil.example/maplanding"))
		const settings = JSON.parse(await fs.readFile(path.join(sessionDirectory, "Settings.json"), "utf8")) as Record<string, unknown>
		for (const [key, value] of Object.entries(qualitySettings)) assert.equal(settings[key], value)
		assert.deepEqual(settings.Serilog, {
			MinimumLevel: "Fatal",
			WriteTo: [{
				Name: "File",
				Args: { path: path.join(sessionDirectory, "libation.log") },
			}],
		})
		service.redirect("user", started.id, redirectUrl)
		assert.equal(loginInput, `${redirectUrl}\r`)
		await waitFor(() => service.snapshot("user")?.phase === "complete")
		const complete = service.snapshot("user")!
		assert.equal(complete.downloaded, 2)
		assert.equal(complete.failed, 1)
		assert.equal(complete.skipped, 1)
		assert.equal(complete.remaining, 0)
		assert.equal(complete.reviewQueue.length, 2)
		assert.equal(JSON.stringify(events).includes("never-stream-this"), false)
		assert.equal(JSON.stringify(events).includes("authorization_code"), false)
		assert.ok(commands.some(args => args[0] === "liberate" && args.includes("FileDownloadQuality=High")))
		await assert.rejects(fs.access(sessionDirectory))
		await assert.rejects(service.start("user", "email@example.com", "us"), /review queue/)
		service.review("user", started.id, "B000000002")
		service.review("user", started.id, "B000000004")
		let reconnect: unknown
		service.subscribe("user", snapshot => {
			reconnect = snapshot
		})()
		assert.deepEqual(reconnect, service.snapshot("user", false))
		const second = await service.start("user", "email@example.com", "us")
		await waitFor(() => Boolean(service.snapshot("user")?.loginUrl))
		service.redirect("user", second!.id, redirectUrl)
		await waitFor(() => service.snapshot("user")?.phase === "complete")
		assert.equal(service.snapshot("user")?.skipped, 3)
	}
	finally {
		unsubscribe()
		await service.shutdown()
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
void test("cancels authentication and removes credentials", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-cancel-"))
	let exit: (code: number) => void = () => undefined
	let directory = ""
	const service = new AudibleImportService({
		spawn: async (_args, dir) => {
			directory = dir
			return {
				write: () => undefined,
				kill: () => {
					exit(1)
				},
				onData: callback => {
					setImmediate(() => callback(`${loginUrl}\r\n`))
				},
				onExit: callback => {
					exit = callback
				},
			}
		},
		validate: async () => undefined,
		hasAsin: async () => false,
		publish: async () => new Book(),
	}, path.join(root, "sessions"))
	try {
		const started = await service.start("user", "email@example.com", "us")
		await waitFor(() => Boolean(service.snapshot("user")?.loginUrl))
		await service.cancel("user", started!.id)
		assert.equal(service.snapshot("user")?.phase, "cancelled")
		await assert.rejects(fs.access(directory))
	}
	finally {
		await service.shutdown()
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
void test("publishes complete files across staging locations without overwriting filename collisions", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-publish-"))
	try {
		const source = path.join(root, "source.m4b")
		const target = path.join(root, "library")
		await fs.writeFile(source, "complete")
		const first = await publishAudio(source, target, "Book")
		const second = await publishAudio(source, target, "Book")
		assert.notEqual(first, second)
		assert.equal(await fs.readFile(first, "utf8"), "complete")
		assert.deepEqual((await fs.readdir(target)).sort(), ["Book (1).m4b", "Book.m4b"])
	}
	finally {
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
void test("real M4B validation and embedded ASIN survives metadata edits, moves, renames and deletion", async () => {
	const {
		execFile,
	} = await import("node:child_process")
	const {
		promisify,
	} = await import("node:util")
	const {
		ffmpegPath,
	} = await import("ffmpeg-ffprobe-static")
	const {
		readAsin,
		writeAsin,
		audioFiles,
	} = await import("../../src/audible/Files.ts")
	const {
		validateM4b,
	} = await import("../../src/audible/ImportService.ts")
	const {
		writeAudioMetadata,
	} = await import("../../src/AudioMetadata.ts")
	const {
		default: ServerBook,
	} = await import("../../src/ServerBook.ts")
	const {
		default: ServerDirectory,
	} = await import("../../src/ServerDirectory.ts")
	assert.ok(ffmpegPath)
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-media-"))
	try {
		const source = path.join(root, "Book.m4b")
		await promisify(execFile)(ffmpegPath, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", "-c:a", "aac", source])
		const mp3 = path.join(root, "Regular book.mp3")
		await promisify(execFile)(ffmpegPath, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", "-c:a", "libmp3lame", mp3])
		assert.equal(readAsin(mp3), "")
		assert.deepEqual(await audioFiles(root), [source])
		await validateM4b(source)
		assert.equal(readAsin(source), "")
		writeAsin(source, "B000000001")
		assert.equal(readAsin(source), "B000000001")
		writeAudioMetadata(source, {
			title: "Renamed metadata",
			performers: ["Author"],
			year: 2026,
			comment: "Description",
			composers: ["Narrator"],
			genres: ["Genre"],
		})
		await validateM4b(source)
		assert.equal(readAsin(source), "B000000001")
		const directory = new ServerDirectory()
		directory.fullPath = root
		const book = new ServerBook()
		book.parent = directory
		await book.updateMetadata(source)
		directory.items.push(book)
		assert.equal(book.asin, "B000000001")
		assert.equal(directory.hasAsin("B000000001"), true)
		const moved = path.join(root, "another-folder")
		await fs.mkdir(moved)
		const renamed = path.join(moved, "Renamed.m4b")
		await fs.rename(source, renamed)
		await book.updateMetadata(renamed)
		assert.equal(directory.hasAsin("B000000001"), true)
		await fs.rm(renamed)
		directory.deleteBook(path.parse(renamed))
		assert.equal(directory.hasAsin("B000000001"), false)
		const invalid = path.join(root, "invalid.m4b")
		await fs.writeFile(invalid, "partial download")
		await assert.rejects(validateM4b(invalid))
	}
	finally {
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
void test("startup removes abandoned credential directories and shutdown terminates live PTY sessions", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-stale-"))
	const sessions = path.join(root, "sessions")
	await fs.mkdir(path.join(sessions, "session-abandoned"), {
		recursive: true,
	})
	await fs.writeFile(path.join(sessions, "session-abandoned", "AccountsSettings.json"), "secret")
	await fs.writeFile(path.join(root, "unrelated"), "keep")
	let killed = false
	let exit: (code: number) => void = () => undefined
	const service = new AudibleImportService({
		spawn: async () => ({
			write: () => undefined,
			kill: () => {
				killed = true
				exit(1)
			},
			onData: callback => {
				setImmediate(() => callback(`${loginUrl}\r\n`))
			},
			onExit: callback => {
				exit = callback
			},
		}),
		validate: async () => undefined,
		hasAsin: async () => false,
		publish: async () => new Book(),
	}, sessions)
	try {
		await service.start("user", "user@example.com", "us")
		await waitFor(() => Boolean(service.snapshot("user")?.loginUrl))
		await assert.rejects(fs.access(path.join(sessions, "session-abandoned")))
		await service.shutdown()
		assert.equal(killed, true)
		assert.equal(await fs.readFile(path.join(root, "unrelated"), "utf8"), "keep")
		await assert.rejects(fs.access(sessions))
	}
	finally {
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
void test("failed login and unavailable Libation report safe errors and remove temporary tokens", async () => {
	for (const unavailable of [false, true]) {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-failed-"))
		let directory = ""
		const service = new AudibleImportService({
			spawn: async (_args, dir) => {
				directory = dir
				await fs.writeFile(path.join(dir, "AccountsSettings.json"), "refresh-token-secret")
				if (unavailable) throw new Error("Sensitive process error: refresh-token-secret")
				return {
					write: () => undefined,
					kill: () => undefined,
					onData: callback => {
						setImmediate(() => callback("Authentication failed: refresh-token-secret"))
					},
					onExit: callback => {
						setImmediate(() => callback(1))
					},
				}
			},
			validate: async () => undefined,
			hasAsin: async () => false,
			publish: async () => new Book(),
		}, path.join(root, "sessions"))
		try {
			await service.start("user", "user@example.com", "us")
			await waitFor(() => service.snapshot("user")?.phase === "failed")
			assert.ok(service.snapshot("user")?.error)
			assert.equal(JSON.stringify(service.snapshot("user")).includes("refresh-token-secret"), false)
			await assert.rejects(fs.access(directory))
		}
		finally {
			await service.shutdown()
			await fs.rm(root, {
				recursive: true,
				force: true,
			})
		}
	}
})
