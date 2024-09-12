import Book from "./Book.js"
import BookStatuses from "./BookStatuses.js"
import ItemType from "./ItemType.js"
import SortOrder from "./SortOrder.js"

export default class Directory {
	items: (Directory | Book)[] = []
	name = ""
	id = ""
	uploadTime = new Date()
	hasBooks = true
	folderPath = ""
	readonly type = ItemType.directory

	constructor(json?: Directory, bookStatuses?: BookStatuses, sortOrder?: SortOrder) {
		if (json) {
			this.name = json.name
			this.id = json.id
			this.hasBooks = json.hasBooks
			this.folderPath = json.folderPath
			let uploadSet = false

			json.items.forEach(i => {
				let upload: Date

				if (i.type === ItemType.book) {
					const status = bookStatuses ? bookStatuses.get(i.id)?.status : undefined
					const book = new Book(i, status)

					this.items.push(new Book(i, status))

					upload = book.uploadTime
				}
				else {
					const dir = new Directory(i, bookStatuses, sortOrder)

					this.items.push(dir)
					upload = dir.uploadTime
				}

				if (sortOrder === SortOrder.UploadedAscending && (!uploadSet || upload < this.uploadTime)) {
					uploadSet = true
					this.uploadTime = upload
				}
				else if (sortOrder === SortOrder.UploadedDescending && (!uploadSet || upload > this.uploadTime)) {
					uploadSet = true
					this.uploadTime = upload
				}
			})

			if (sortOrder) {
				switch (sortOrder) {
					case SortOrder.AlphabeticallyDescending:
						this.items.reverse()
						break
					case SortOrder.AlphabeticallyAscending:
						break
					case SortOrder.UploadedAscending:
						this.items.sort((a, b) => {
							return a.uploadTime > b.uploadTime ? 1 : -1
						})
						break
					case SortOrder.UploadedDescending:
						this.items.sort((a, b) => {
							return a.uploadTime > b.uploadTime ? -1 : 1
						})
						break
				}
			}
		}
	}

	bookCount() {
		let count = 0

		this.items.forEach(i => {
			if (i.type === ItemType.book) {
				count += 1
			}
			else {
				count += i.bookCount()
			}
		})

		return count
	}

	toJSON() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const directory: any = { ...this }

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		delete directory.uploadTime

		return directory as unknown
	}
}
