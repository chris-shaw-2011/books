import { Status } from "./Book.js"

export default class BookWithStatus {
	dateStatusSet = 0
	status: Status = Status.Unread

	constructor(json?: Partial<BookWithStatus>) {
		if (json) {
			this.status = json.status ?? Status.Unread
			this.dateStatusSet = json.dateStatusSet ?? 0  // Provide default value for undefined
		}
	}
}
