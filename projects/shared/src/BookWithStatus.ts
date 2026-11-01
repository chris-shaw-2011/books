import typia from "typia"
import { type Status } from "./Book.ts"

export default class BookWithStatus {
	static fromUnknown(json: unknown) {
		return new BookWithStatus(typia.assert<typia.Primitive<BookWithStatus>>(json))
	}

	dateStatusSet: Date
	status: Status

	constructor(json?: Partial<BookWithStatus> | Partial<typia.Primitive<BookWithStatus>>) {
		const data = json ?? {}

		this.status = data.status ?? "Unread"
		this.dateStatusSet = new Date(data.dateStatusSet ?? 0)
	}

	toJSON(): Omit<BookWithStatus, "dateStatusSet" | "toJSON"> & { dateStatusSet?: number | Date } {
		return {
			status: this.status,
			dateStatusSet: new Date(this.dateStatusSet).getTime(),
		}
	}
}
