import BookWithStatus from "./BookWithStatus.js"

export default class BookStatuses extends Map<string, BookWithStatus> {
	constructor(json?: Record<string, Partial<BookWithStatus>> | BookStatuses) {
		super()

		if (json instanceof BookStatuses) {
			json.forEach((value, key) => {
				this.set(key, new BookWithStatus({
					status: value.status,
					dateStatusSet: value.dateStatusSet,
				}))
			})
		}
		else if (json) {
			Object.keys(json).forEach(key => {
				const statusData = json[key]

				this.set(key, new BookWithStatus(statusData))
			})
		}
	}

	//This may not be necessary
	static fromJSON(jsonString?: string): BookStatuses {
		if (jsonString) {
			const parsed = JSON.parse(jsonString) as Record<string, Partial<BookWithStatus>>

			return new BookStatuses(parsed)
		}
		else {
			return new BookStatuses()
		}
	}
}
