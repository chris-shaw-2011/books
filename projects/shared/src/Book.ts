import Item from "./Item.ts"

export const StatusValues = ["Unread", "Read", "Skipped"] as const

export type Status = typeof StatusValues[number]

export default class Book extends Item {
	author: string
	numBytes: number
	cover: string
	download: string
	status: Status
	year: number
	comment: string
	duration: number
	narrator: string
	genre: string

	override readonly type = "Book"

	constructor(json?: Partial<Book>, status?: Status) {
		super(json)

		this.author = json?.author?.trim() ?? ""
		this.numBytes = json?.numBytes ?? 0
		this.cover = json?.cover ?? ""
		this.download = json?.download ?? ""
		this.status = json?.status ?? "Unread"
		this.year = json?.year ?? 0
		this.comment = json?.comment?.trim() ?? ""
		this.duration = json?.duration ?? 0
		this.narrator = json?.narrator?.trim() ?? ""
		this.genre = json?.genre?.trim() ?? ""

		if (status !== undefined) {
			this.status = status
		}
	}

	toJSON(): Omit<Book, "uploadTime" | "toJSON"> & { uploadTime?: number } {
		return {
			author: this.author,
			numBytes: this.numBytes,
			cover: this.cover,
			download: this.download,
			status: this.status,
			year: this.year,
			comment: this.comment,
			duration: this.duration,
			narrator: this.narrator,
			genre: this.genre,
			id: this.id,
			name: this.name,
			folderPath: this.folderPath,
			uploadTime: new Date(this.uploadTime).getTime(),
			type: "Book",
		}
	}
}