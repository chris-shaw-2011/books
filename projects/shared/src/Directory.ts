import Book from "./Book.ts"
import BookStatuses from "./BookStatuses.ts"
import ItemBase, { type Item } from "./Item.ts"

export default class Directory extends ItemBase {
	override readonly type = "Directory"

	items: Item[]
	hasBooks: boolean

	constructor(json?: Partial<Directory>, bookStatuses?: BookStatuses) {
		super(json)

		this.hasBooks = json?.hasBooks ?? false
		this.items = json?.items?.map(item => item.type === "Book" ? new Book(item, bookStatuses?.get(item.id)?.status) : new Directory(item, bookStatuses)) ?? []
	}

	get maxUploadTime(): Date | undefined {
		let latest: Date | undefined
		for (const item of this.items) {
			const time = item.type === "Book" ? item.uploadTime : item.maxUploadTime
			if (time && (!latest || time > latest)) latest = time
		}
		return latest
	}

	get minUploadTime(): Date | undefined {
		let earliest: Date | undefined
		for (const item of this.items) {
			const time = item.type === "Book" ? item.uploadTime : item.minUploadTime
			if (time && (!earliest || time < earliest)) earliest = time
		}
		return earliest
	}

	bookCount() {
		let count = 0

		this.items.forEach(i => {
			if (i.type === "Book") {
				count += 1
			}
			else {
				count += i.bookCount()
			}
		})

		return count
	}

	findBookByAsin(asin: string): Book | undefined {
		if (!asin) return
		for (const item of this.items) {
			if (item.type === "Book") {
				if (item.asin === asin) return item
			}
			else {
				const book = item.findBookByAsin(asin)
				if (book) return book
			}
		}
	}

	toJSON(): Omit<Directory, "maxUploadTime" | "minUploadTime" | "bookCount" | "findBookByAsin" | "toJSON"> {
		return {
			items: this.items,
			hasBooks: this.hasBooks,
			id: this.id,
			name: this.name,
			folderPath: this.folderPath,
			type: "Directory",
		}
	}
}
