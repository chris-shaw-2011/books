import BookWithStatus from "./BookWithStatus.ts"

export default class BookStatuses extends Map<string, BookWithStatus> {
	constructor(json?: Record<string, Partial<BookWithStatus>> | BookStatuses) {
		super()

		if (json instanceof BookStatuses) {
			json.forEach((value, key) => {
				this.set(key, new BookWithStatus(value))
			})
		}
		else if (json) {
			Object.keys(json).forEach(key => {
				const statusData = json[key]

				this.set(key, new BookWithStatus(statusData))
			})
		}
	}

	toJSON(): Record<string, BookWithStatus> {
		const obj: Record<string, BookWithStatus> = {}

		this.forEach((value, key) => {
			obj[key] = value
		})

		return obj
	}
}
