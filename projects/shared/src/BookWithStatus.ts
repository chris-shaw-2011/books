import { type Status } from "./Book.js"

export default class BookWithStatus {
	dateStatusSet: number
	status: Status

	constructor(json?: Partial<BookWithStatus>) {
		this.status = json?.status ?? "Unread"
		this.dateStatusSet = json?.dateStatusSet ?? 0
	}
}
