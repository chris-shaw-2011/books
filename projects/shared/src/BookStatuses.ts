import typia from "typia"
import BookWithStatus from "./BookWithStatus.ts"

export default class BookStatuses extends Map<string, BookWithStatus> {
	static fromUnknown(json: unknown) {
		return new BookStatuses(typia.assert<typia.Primitive<BookStatuses>>(json))
	}

	constructor(json?: BookStatuses | Record<string, Partial<BookWithStatus> | Partial<typia.Primitive<BookWithStatus>>>) {
		super()

		if (json instanceof BookStatuses) {
			json.forEach((value, key) => {
				this.set(key, new BookWithStatus(value))
			})
		}
		else if (json) {
			for (const [key, status] of Object.entries(json)) this.set(key, new BookWithStatus(status))
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
