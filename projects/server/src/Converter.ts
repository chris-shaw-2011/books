import { Mutex } from "async-mutex"
import { type ChildProcess, exec, type ExecOptions } from "child_process"
import { EventEmitter } from "events"
import { ffprobePath, ffmpegPath } from "ffmpeg-ffprobe-static"
import fs from "fs"
import { parseFile } from "music-metadata"
import path from "path"
import sanitize from "sanitize-filename"
import unzipper from "unzipper"
import { type ConverterStatus } from "@books/shared"
import bookList from "./BookList.ts"
import folderSize from "get-folder-size"
import * as mm from "music-metadata"

// Set this to true if you want to make sure no intermediate files are removed as things are converted
// This is useful in debugging if you want to check various stages of the conversion
const keepIntermediateFiles = false

function toString(data: unknown) {
	let ret = ""
	if (data?.toString) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		ret = data.toString()
	}

	return ret
}

function onExit(childProcess: ChildProcess): Promise<void> {
	return new Promise((resolve, reject) => {
		childProcess.once("exit", code => {
			if (code === 0) {
				resolve(undefined)
			}
			else {
				reject(new Error(`Exit with error code:  ${code ?? 0}`))
			}
		})
		childProcess.once("error", (err: Error) => {
			reject(err)
		})
	})
}

export default class Converter {
	constructor() {
		this._status = "Waiting"
	}

	totalDurations = new Map<string, number>()
	_percentComplete = 0
	eventEmitter = new EventEmitter()
	errorMessage = ""
	_convertedFilePath = ""

	private _status: ConverterStatus
	private _fileNames: string[] = []

	get percentComplete() {
		return this._percentComplete
	}

	set percentComplete(value: number) {
		this._percentComplete = value
		this.eventEmitter.emit("update")
	}

	get status() {
		return this._status
	}

	set status(value: ConverterStatus) {
		if (this._status != value) {
			if (value === "Complete") {
				this._percentComplete = 100
			}
			else {
				this._percentComplete = 0
				this._fileNames = []
			}
		}

		this._status = value
		this.eventEmitter.emit("update")
	}

	get fileNames() {
		return this._fileNames
	}

	get convertedFilePath() {
		return this._convertedFilePath
	}

	waitForUpdate = async (knownPercent: number, knownStatus: ConverterStatus, knownWorkingFiles: string[]) => {
		if (knownPercent === this.percentComplete && this.status !== "Complete" && this.status !== "Error" && this.status === knownStatus && this.arraysEqual(this.fileNames, knownWorkingFiles)) {
			const promise = new Promise<number>(resolve => {
				this.eventEmitter.once("update", resolve)
			})

			return Promise.race([promise, new Promise<void>(resolve => {
				setTimeout(() => {
					this.eventEmitter.removeListener("update", resolve)
					resolve()
				}, 10000)
			})])
		}
	}

	parseData = (data: string, outputFile: string) => {
		const str = data
		const totalDuration = this.totalDurations.get(outputFile)

		if (totalDuration === undefined) {
			const matches = /Duration: ([\d]{1,3}):([\d]{1,2})(?::([\d]{1,2}))?.*, start/.exec(str)

			if (matches) {
				this.totalDurations.set(outputFile, this.durationToSeconds(matches))
			}
		}
		else {
			const matches = /size=.* time=([\d]{1,3}):([\d]{1,2})(?::([\d]{1,2}))?.* bitrate=/.exec(str)

			if (matches) {
				const completeDuration = this.durationToSeconds(matches)

				this.percentComplete = Math.round(completeDuration / totalDuration * 100)

				// eslint-disable-next-line no-console
				console.log(`${outputFile} - ${this.percentComplete}% complete`)
			}
		}
	}

	convert = async (filePath: string, baseFilePath: string, mutex: Mutex, rootDir: string) => {
		await mutex.acquire()
		await bookList.pauseUpdates()

		let outputFilePath: string | undefined

		if (filePath.toLowerCase().endsWith(".zip")) {
			const unzipPath = filePath.substring(0, filePath.length - 4)
			const files = await this.unzip(filePath, unzipPath)

			await this.remove(filePath)

			if (files.some(str => str.toLowerCase().endsWith(".mp3"))) {
				outputFilePath = `${filePath}.mp3`

				await this.combineFiles(files, outputFilePath, "mp3")
			}
			else {
				// TODO: figure out how to run these in parallel rather than in serial
				// Will have to make sure to update the UI so it shows the percentage of each file
				const aaxFiles = files.filter(str => str.toLowerCase().endsWith(".aax"))

				for (const file of aaxFiles) {
					const convertedFileOutputPath = `${file}.m4b`
					const coverPhotoOutputPath = `${file}.jpg`

					await this.convertAax(file, convertedFileOutputPath, rootDir, coverPhotoOutputPath)

					files.splice(files.indexOf(file), 1, convertedFileOutputPath, coverPhotoOutputPath)

					await this.remove(file)
				}

				outputFilePath = `${filePath}.m4b`

				await this.combineFiles(files, outputFilePath, "m4b")
			}

			await this.remove(unzipPath)
		}
		else if (filePath.toLowerCase().endsWith(".aax")) {
			outputFilePath = `${filePath}.m4b`

			await this.convertAax(filePath, outputFilePath, rootDir)
		}

		if (outputFilePath) {
			const metadata = (await parseFile(outputFilePath, { skipCovers: true, skipPostHeaders: true, includeChapters: false }))
			const extension = path.extname(outputFilePath)

			if (metadata.common.title) {
				const sanitized = sanitize(metadata.common.title.replace(/:/gi, " - "))
				let desiredFilePath = path.join(baseFilePath, `${sanitized}${extension}`)

				if (fs.existsSync(desiredFilePath)) {
					desiredFilePath = path.join(baseFilePath, `${sanitized} - ${path.basename(outputFilePath)}`)
				}

				await fs.promises.rename(outputFilePath, desiredFilePath)

				this._convertedFilePath = desiredFilePath
			}
		}

		await bookList.fileAdded(this.convertedFilePath)
		bookList.resumeUpdates()

		this.status = "Complete"
		mutex.release()
	}

	private unzip = async (zipPath: string, unzipPath: string) => {
		this.status = "Extracting"

		const openFile = (await unzipper.Open.file(zipPath))
		const files = openFile.files
		const sizeToUnzip = files.map(f => f.uncompressedSize).reduce((totalSize: number, currSize) => totalSize + currSize)
		const unzippedFiles: string[] = []
		const percentageUpdater = setInterval(() => {
			void folderSize.loose(unzipPath).then(number => {
				this.percentComplete = Math.round((number / sizeToUnzip) * 100)
			})
		}, 250)

		await fs.promises.mkdir(unzipPath)

		// Create directories first
		for (const file of files) {
			const destPath = path.join(unzipPath, file.path)

			this._fileNames = [path.basename(file.path)]

			if (file.type === "Directory" && !fs.existsSync(destPath)) {
				await fs.promises.mkdir(destPath)
			}
			else {
				const destParsed = path.parse(destPath)

				if (!fs.existsSync(destParsed.dir)) {
					await fs.promises.mkdir(destParsed.dir, { recursive: true })
				}

				await new Promise(resolve => {
					const unzipLoc = path.join(unzipPath, file.path)

					unzippedFiles.push(unzipLoc)
					file.stream().pipe(fs.createWriteStream(unzipLoc)).on("finish", () => resolve(""))
				})
			}
		}

		clearInterval(percentageUpdater)

		return unzippedFiles.sort()
	}

	private combineFiles = async (unzippedFiles: string[], outputFilePath: string, fileExtension: string): Promise<boolean> => {
		this.status = "Combining"

		// TODO: can probably remove the fileExtension parameter from this since I think we can do the same thing for mp3 as m4b here
		const files: string[] = []
		let bestCover = ""
		let bestCoverSize = 0
		let outputTitle = ""
		const addMetaData = (args: string[], key: string, value: string | number | undefined) => {
			if (value !== undefined) {
				if (typeof value === "number") {
					args.push("-metadata", `${key}=${value}`)
				}
				else {
					args.push("-metadata", `${key}="${value.replace("\"", "\\\"")}"`)
				}
			}
		}

		for (const file of unzippedFiles) {
			if (file.toLowerCase().endsWith(fileExtension)) {
				files.push(file)

				if (!outputTitle) {
					outputTitle = path.basename(file).replace("-Part00.mp3", "").replace("-Part01.mp3", "")
				}
			}
			else if (file.toLowerCase().endsWith("jpg")) {
				const size = (await fs.promises.stat(file)).size

				if (size > bestCoverSize) {
					bestCover = file
					bestCoverSize = size
				}
			}
		}

		if (files.length) {
			const args = ["-i"]
			const metadata = { title: outputTitle, artist: "", year: 0, comment: "", composer: "", genre: "" }
			let concatFile = ""
			let chaptersFile = ""
			let coverPicturePath = bestCover ? bestCover : ""
			let coverInput = 0
			let chapterInput = 0

			if (fileExtension === "m4b") {
				let addedMetadata = false
				const fileCommands: string[] = []
				const chapters: Chapter[] = []

				concatFile = `${outputFilePath}.concat.txt`

				for (const file of files) {
					const fileChapters = JSON.parse(await this.runFfprobe(file, ["-v", "error", "-print_format", "json", "-show_chapters", `"${file}"`])) as Chapters

					if (chapters.length) {
						let setChapterNames = false
						const lastChapter = chapters[chapters.length - 1]
						const updatedChapters = fileChapters.chapters.map((c, i) => {
							if (i === 0 && c.tags.title.toLowerCase() === "chapter 1") {
								setChapterNames = true
							}

							c.start += lastChapter.end
							c.end += lastChapter.end
							c.id += lastChapter.id + 1

							if (setChapterNames) {
								c.tags.title = `Chapter ${c.id + 1}`
							}

							return c
						})

						chapters.push(...updatedChapters)
					}
					else {
						chapters.push(...fileChapters.chapters)
					}

					fileCommands.push(`file '${file}'`)

					if (!addedMetadata) {
						const fileMetadata = await mm.parseFile(file, { skipCovers: true, includeChapters: true })

						if (fileMetadata.common.artists?.length) {
							metadata.artist = fileMetadata.common.artists.join(", ")
						}
						else if (fileMetadata.common.artist) {
							metadata.artist = fileMetadata.common.artist
						}

						if (fileMetadata.common.year) {
							metadata.year = fileMetadata.common.year
						}

						if (fileMetadata.common.comment?.length && fileMetadata.common.comment[0].text) {
							metadata.comment = fileMetadata.common.comment[0].text
						}

						if (fileMetadata.common.genre?.length) {
							metadata.genre = fileMetadata.common.genre.map(g => g).join(", ")
						}

						if (!coverPicturePath && fileMetadata.common.picture?.length) {
							coverPicturePath = `${outputFilePath}.jpg`

							await fs.promises.writeFile(coverPicturePath, fileMetadata.common.picture[0].data)
						}

						if (fileMetadata.common.title) {
							metadata.title = fileMetadata.common.title
						}

						addedMetadata = true
					}
				}

				await fs.promises.writeFile(concatFile, fileCommands.join("\n"))

				if (chapters.length) {
					chaptersFile = `${outputFilePath}.chapters.ffmetadata`

					const writeStream = fs.createWriteStream(chaptersFile)

					writeStream.write(";FFMETADATA1\n")

					for (const chapter of chapters) {
						writeStream.write("[CHAPTER]\n")
						writeStream.write(`TIMEBASE=${chapter.time_base}\n`)
						writeStream.write(`START=${chapter.start}\n`)
						writeStream.write(`END=${chapter.end}\n`)
						writeStream.write(`title=${chapter.tags.title}\n`)
					}

					writeStream.close()
				}
			}

			this._fileNames = files.map(f => path.basename(f))

			if (files.length > 1) {
				let outputDuration = 0

				// When concatenating using the concat file the total duration of the output file won't be displayed in ffmpeg so in order to give the user progress feedback we need to calculate that here
				for (const file of files) {
					const metadata = await mm.parseFile(file, { skipCovers: true, includeChapters: false })

					if (metadata.format.duration) {
						outputDuration += metadata.format.duration
					}
				}

				this.totalDurations.set(outputFilePath, outputDuration)

				if (concatFile) {
					args.unshift("-f", "concat", "-safe", "0")
					args.push(`"${concatFile}"`)
				}
				else {
					args.push(`"concat:${files.join("|")}"`)
				}
			}
			else {
				args.push(`"${files[0]}"`)
			}

			if (coverPicturePath) {
				args.push("-i", `"${coverPicturePath}"`)
				coverInput = 1
			}

			if (chaptersFile) {
				args.push("-i", `"${chaptersFile}"`)
				chapterInput = coverInput ? 2 : 1
			}

			args.push("-map", "0:0")

			if (coverPicturePath) {
				args.push("-map", `${coverInput}:0`)
			}

			args.push("-c", "copy", "-id3v2_version", "3")

			if (chaptersFile) {
				args.push("-map_chapters", `${chapterInput}`)
			}

			if (coverPicturePath && fileExtension === "m4b") {
				args.push("-disposition:v:0", "attached_pic")
			}

			if (metadata.title) {
				addMetaData(args, "title", metadata.title)
			}

			if (metadata.artist) {
				addMetaData(args, "artist", metadata.artist)
			}

			if (metadata.year) {
				addMetaData(args, "year", metadata.year)
				addMetaData(args, "date", metadata.year.toString())
			}

			if (metadata.comment) {
				addMetaData(args, "comment", metadata.comment)
			}

			if (metadata.composer) {
				addMetaData(args, "composer", metadata.composer)
			}

			if (metadata.genre) {
				addMetaData(args, "genre", metadata.genre)
			}

			args.push(`"${outputFilePath}"`)

			if (!(await this.runFfmpeg(outputFilePath, args))) {
				return false
			}

			if (concatFile) {
				await this.remove(concatFile)
			}

			if (chaptersFile) {
				await this.remove(chaptersFile)
			}

			return true
		}

		return false
	}

	private convertAax = async (inputFilePath: string, outputFilePath: string, rootDir: string, outputCoverPhotoPath?: string) => {
		const encryptionKey = await this.crack(inputFilePath, rootDir)

		if (!encryptionKey) {
			return
		}

		this.status = "Converting"
		this._fileNames = [path.basename(inputFilePath)]

		// TODO: this appears to cause chapters to be lost, at some point I should fix this up so I first get the chapters then skip the first 2 seconds
		const args = ["-activation_bytes", encryptionKey,
			"-ss", "00:00:02", // Skip the first 2 seconds so we don't have to hear "This is audible"
			"-i", `"${inputFilePath}"`,
			"-map", "0:a", "-c copy", `"${outputFilePath}"`, // copy the audio stream only to the m4b file
		]

		await this.runFfmpeg(outputFilePath, args)

		if (outputCoverPhotoPath) {
			const args2 = ["-activation_bytes", encryptionKey, "-i", `"${inputFilePath}"`, "-map", "0:v:0", "-c:v", "mjpeg", `"${outputCoverPhotoPath}"`]

			await this.runFfmpeg(outputCoverPhotoPath, args2)
		}
	}

	private crack = async (inputFilePath: string, rootDir: string) => {
		this.status = "Cracking"
		this._fileNames = [path.basename(inputFilePath)]

		const probeOutput = await this.runFfprobe(inputFilePath, [`"${inputFilePath}"`])
		const matches = /file checksum == (.*)/.exec(probeOutput)

		if (!matches) {
			this.errorMessage += `Couldn't find checksum from ffprobe

         ${probeOutput}`
			this.status = "Error"

			return ""
		}

		const cwd = path.join(rootDir, "inAudible-NG")
		const crackerPath = process.platform === "win32" ? path.join(cwd, "run", "rcrack.exe") : path.join(cwd, "rcrack")
		const crackerOutput = await this.runProgram(crackerPath, `${inputFilePath}.rcrack.log`, [".", "-h", matches[1]])
		const activationBytesMatches = /hex:(.*)/.exec(crackerOutput)

		if (activationBytesMatches) {
			return activationBytesMatches[1]
		}
		else {
			this.errorMessage += `Couldn't find activation bytes in cracker output

         ${crackerOutput}
         `
			this.status = "Error"

			return ""
		}
	}

	private async runFfmpeg(outputFilePath: string, args: string[]) {
		if (!ffmpegPath) {
			throw Error("ffprobePath is null")
		}

		return this.runProgram(ffmpegPath, `${outputFilePath}.ffmpeg.log`, args, data => this.parseData(data, outputFilePath))
	}

	private async runFfprobe(inputFilePath: string, args: string[]) {
		if (!ffprobePath) {
			throw Error("ffprobePath is null")
		}

		return await this.runProgram(ffprobePath, `${inputFilePath}.ffprobe.log`, args)
	}

	private async runProgram(programPath: string, logPath: string, args: string[], onData?: (data: string) => void, workingDirectory?: string) {
		const cmd = `"${programPath}" ${args.join(" ")}`
		const writeStream = fs.createWriteStream(logPath)
		const execOptions: ExecOptions = workingDirectory ? { cwd: workingDirectory } : {}
		const program = exec(cmd, execOptions)
		let programOutput = ""
		const dataCallback = (data: unknown) => {
			const str = toString(data)

			programOutput += str

			if (onData) {
				onData(str)
			}
		}

		writeStream.write(`Executing command: ${cmd}`)

		if (workingDirectory) {
			writeStream.write(` from working directory ${workingDirectory}`)
		}

		writeStream.write("\n\n")

		program.stdout?.on("data", dataCallback)
		program.stdout?.pipe(writeStream)

		program.stderr?.on("data", dataCallback)
		program.stderr?.pipe(writeStream)

		try {
			await onExit(program)

			writeStream.close()
		}
		catch (e) {
			writeStream.close()

			if (e instanceof Error) {
				this.errorMessage += `${e.message}\n\n${e.stack}\n\n`
			}

			this.errorMessage += await fs.promises.readFile(logPath, "utf8")
			this.status = "Error"
		}

		await this.remove(logPath)

		return programOutput
	}

	private durationToSeconds(matches: RegExpMatchArray) {
		let multiplier = 1
		let seconds = 0

		matches.reverse().forEach(m => {
			const num = parseInt(m, 10)

			if (m && !isNaN(num)) {
				seconds += num * multiplier
				multiplier *= 60
			}
		})

		return seconds
	}

	private async remove(path: string) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!keepIntermediateFiles) {
			await fs.promises.rm(path, { recursive: true })
		}
		else {
			// eslint-disable-next-line no-console
			console.warn(`Not removing ${path} because keepIntermediateFiles is true`)
		}
	}

	private arraysEqual(a: string[], b: string[]) {
		if (a.length !== b.length) {
			return false
		}

		return a.every((val, index) => val === b[index])
	}
}

interface ChapterTag {
	title: string,
}

interface Chapter {
	id: number,
	time_base: string,
	start: number,
	end: number,
	tags: ChapterTag,
}

interface Chapters {
	chapters: Chapter[],
}