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

	static fromJSON(jsonString?: string): BookStatuses {
		if (jsonString) {
			const parsed = JSON.parse(jsonString) as unknown  // Parse as unknown to avoid any type assignment

			if (BookStatuses.isValid(parsed)) {
				return new BookStatuses(parsed)
			}
			else {
				throw new Error("Invalid JSON format for BookStatuses.")
			}
		}
		else {
			return new BookStatuses()
		}
	}

	private static isValid(json: unknown): json is Record<string, Partial<BookWithStatus>> {
		if (typeof json !== "object" || json === null) {
			return false
		}

		return Object.values(json).every(
			item =>
				typeof item === "object" &&
				item !== null &&
				("status" in item || "dateStatusSet" in item) &&
				(typeof (item as Partial<BookWithStatus>).status === "string" || typeof (item as Partial<BookWithStatus>).status === "undefined") &&
				(typeof (item as Partial<BookWithStatus>).dateStatusSet === "number" || typeof (item as Partial<BookWithStatus>).dateStatusSet === "undefined")
		)
	}
}
