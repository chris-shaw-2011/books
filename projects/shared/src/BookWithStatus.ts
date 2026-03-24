import { type Status } from "./Book.ts"

export default class BookWithStatus {
	dateStatusSet: Date
	status: Status

	constructor(json?: Partial<BookWithStatus>) {
		this.status = json?.status ?? "Unread"
		this.dateStatusSet = new Date(json?.dateStatusSet ?? 0)
	}

	toJSON(): Omit<BookWithStatus, "dateStatusSet" | "toJSON"> & { dateStatusSet?: number | Date } {
		return {
			status: this.status,
			dateStatusSet: new Date(this.dateStatusSet).getTime(),
		}
	}
}
