import Book from "./Book.js"
import BookStatuses from "./BookStatuses.js"
import Item from "./Item.js"
import { type SortOrder } from "./SortOrder.js"

export default class Directory extends Item {
	override readonly type = "Directory"

	items: (Directory | Book)[]
	hasBooks: boolean

	constructor(json?: Partial<Directory>, bookStatuses?: BookStatuses, sortOrder?: SortOrder) {
		super(json)

		this.hasBooks = json?.hasBooks ?? false
		this.items = []

		let upload: Date | number | undefined

		json?.items?.forEach(i => {
			const newUpload = i.uploadTime

			if (i.type === "Book") {
				const status = bookStatuses ? bookStatuses.get(i.id)?.status : undefined
				const book = new Book(i, status)

				this.items.push(book)
			}
			else {
				const dir = new Directory(i, bookStatuses, sortOrder)

				this.items.push(dir)
			}

			if (sortOrder === "Uploaded - Ascending" && (!upload || newUpload < this.uploadTime)) {
				upload = newUpload
			}
			else if (sortOrder === "Uploaded - Descending" && (!upload || newUpload > this.uploadTime)) {
				upload = newUpload
			}
		})

		this.uploadTime = upload ?? this.uploadTime

		if (sortOrder) {
			switch (sortOrder) {
				case "Alphabetically - Descending":
					this.items.reverse()
					break
				case "Alphabetically - Ascending":
					break
				case "Uploaded - Ascending":
					this.items.sort((a, b) => {
						return a.uploadTime > b.uploadTime ? 1 : -1
					})
					break
				case "Uploaded - Descending":
					this.items.sort((a, b) => {
						return a.uploadTime > b.uploadTime ? -1 : 1
					})
					break
			}
		}
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

	toJSON(): Omit<Directory, "uploadTime" | "bookCount" | "toJSON"> & { uploadTime?: number } {
		return {
			items: this.items,
			hasBooks: this.hasBooks,
			id: this.id,
			name: this.name,
			folderPath: this.folderPath,
			uploadTime: new Date(this.uploadTime).getTime(),
			type: "Directory",
		}
	}
}
