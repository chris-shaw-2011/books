import { Book, type Status } from "@books/shared"
import { execFile } from "child_process"
import { ffmpegPath } from "ffmpeg-ffprobe-static"
import fs from "fs"
import ServerDirectory from "./ServerDirectory.ts"
import path from "path"
import { readAudioMetadata, writeMp3Cover } from "./AudioMetadata.ts"

export default class ServerBook extends Book {
	fullPath = ""
	parent = new ServerDirectory()
	photoPath = ""

	static calculateBookId(directory: ServerDirectory, filePath: string) {
		const pathTree = directory.pathTree.concat(!directory.name ? [] : directory.name)
		const fileName = path.win32.basename(filePath)

		return pathTree.concat(fileName).join("/")
	}

	constructor(json?: ServerBook, status?: Status) {
		super(json, status)

		if (json) {
			this.fullPath = json.fullPath
			this.parent = json.parent
			this.photoPath = json.photoPath
		}
	}

	private async extractCoverFromAttachedPicture(fullPath: string) {
		const ffmpegBinary = ffmpegPath

		if (!ffmpegBinary) {
			return false
		}

		try {
			// Fall back to FFmpeg for attached pictures that TagLib cannot read.
			await new Promise<void>((resolve, reject) => {
				execFile(
					ffmpegBinary,
					["-y", "-v", "error", "-i", fullPath, "-map", "0:v:0", "-frames:v", "1", "-c:v", "copy", this.photoPath],
					(error: Error | null) => {
						if (error) {
							reject(error)
						}
						else {
							resolve()
						}
					},
				)
			})

			const photoStats = await fs.promises.stat(this.photoPath).catch(() => undefined)

			if (!photoStats || photoStats.size === 0) {
				await fs.promises.rm(this.photoPath, { force: true })

				return false
			}

			// If ffmpeg found an image and we're dealing with an mp3, write the extracted image to the id3 tag so that the mp3 has a proper cover photo
			if (path.extname(fullPath).toLowerCase() === ".mp3") {
				writeMp3Cover(fullPath, this.photoPath)
			}

			return true
		}
		catch {
			await fs.promises.rm(this.photoPath, { force: true })

			return false
		}
	}

	async updateMetadata(filePath?: string) {
		const fullPath = filePath ?? this.fullPath
		const fileName = path.win32.basename(fullPath)
		const bookUri = ServerBook.calculateBookId(this.parent, fullPath)

		this.photoPath = `${fullPath}.jpg`

		// eslint-disable-next-line no-console
		console.log(`${fullPath} - reading tags`)

		const metadata = readAudioMetadata(fullPath, { duration: true, picture: !fs.existsSync(this.photoPath) })
		const stats = (await fs.promises.stat(fullPath))

		this.name = metadata.title || fileName
		this.author = metadata.performers.join(", ")

		this.year = metadata.year || this.year
		this.comment = metadata.comment
		this.duration = metadata.duration || this.duration
		this.narrator = metadata.composers.join(", ")
		this.genre = metadata.genres.join(", ")

		if (!fs.existsSync(this.photoPath)) {
			const data = metadata.picture

			if (data.length) {
				await fs.promises.writeFile(this.photoPath, data)
			}
			else {
				await this.extractCoverFromAttachedPicture(fullPath)
			}
		}

		this.id = bookUri
		this.download = `/files/${bookUri}`
		this.cover = `${this.download}.jpg`
		this.numBytes = stats.size
		this.fullPath = fullPath
		this.uploadTime = stats.birthtimeMs && stats.birthtime < stats.mtime ? stats.birthtime : stats.mtime
		this.folderPath = path.parse(`/${bookUri}`).dir
	}
}
