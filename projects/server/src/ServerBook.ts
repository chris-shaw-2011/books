import { Book, type Status } from "@books/shared"
import { execFile } from "child_process"
import { ffmpegPath } from "ffmpeg-ffprobe-static"
import * as mm from "music-metadata"
import fs from "fs"
import NodeID3 from "node-id3"
import ServerDirectory from "./ServerDirectory.ts"
import path from "path"

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
			// Some audio files have invalid id3 tags that music-metadata can't parse but ffmpeg can so we fall back to ffmpeg to try and get cover images
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
				await NodeID3.Promise.update({
					image: this.photoPath,
				}, fullPath)
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

		const metadata = (await mm.parseFile(fullPath, { skipCovers: fs.existsSync(this.photoPath), includeChapters: false }))
		const tags = metadata.common
		const stats = (await fs.promises.stat(fullPath))

		this.name = tags.title ?? fileName
		this.author = tags.artists?.length ? tags.artists.join(", ") : tags.artist ?? ""

		if (tags.year !== undefined) {
			this.year = tags.year
		}

		this.comment = tags.comment?.length ? tags.comment[0].text ?? "" : ""

		if (metadata.format.duration !== undefined) {
			this.duration = metadata.format.duration
		}

		this.narrator = tags.composer?.length ? tags.composer.join(", ") : ""
		this.genre = tags.genre?.length ? tags.genre.join(", ") : ""

		if (!fs.existsSync(this.photoPath)) {
			if (tags.picture?.length) {
				await fs.promises.writeFile(this.photoPath, tags.picture[0].data)
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
		this.uploadTime = stats.birthtimeMs ? stats.birthtime : stats.mtime
		this.folderPath = path.parse(`/${bookUri}`).dir
	}
}