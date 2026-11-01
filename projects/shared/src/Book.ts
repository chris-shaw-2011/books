import typia from "typia"
import ItemBase from "./Item.ts"

export const StatusValues = ["Unread", "Read", "Skipped"] as const

export type Status = typeof StatusValues[number]

export default class Book extends ItemBase {
	static fromUnknown(json: unknown) {
		return new Book(typia.assert<typia.Primitive<Book>>(json))
	}

	uploadTime: Date
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
	asin: string
	series: string
	seriesOrder: number | undefined

	override readonly type = "Book"

	constructor(json?: Partial<Book> | Partial<typia.Primitive<Book>>, status?: Status) {
		const data = json ?? {}
		super(data)

		this.uploadTime = new Date(data.uploadTime ?? 0)
		this.author = data.author?.trim() ?? ""
		this.numBytes = data.numBytes ?? 0
		this.cover = data.cover ?? ""
		this.download = data.download ?? ""
		this.status = data.status ?? "Unread"
		this.year = data.year ?? 0
		this.comment = data.comment?.trim() ?? ""
		this.duration = data.duration ?? 0
		this.narrator = data.narrator?.trim() ?? ""
		this.genre = data.genre?.trim() ?? ""
		this.asin = data.asin ?? ""
		this.series = data.series ?? ""
		this.seriesOrder = data.seriesOrder

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
			asin: this.asin,
			series: this.series,
			seriesOrder: this.seriesOrder,
			id: this.id,
			name: this.name,
			folderPath: this.folderPath,
			uploadTime: this.uploadTime.getTime(),
			type: "Book",
		}
	}
}
