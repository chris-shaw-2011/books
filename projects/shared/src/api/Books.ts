import BookStatuses from "../BookStatuses.js"
import Directory from "../Directory.js"
import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class Books extends ApiMessage {
	directory = new Directory()
	bookStatuses = new BookStatuses()

	constructor(json?: Books) {
		super(ApiMessageType.Books)

		if (json) {
			this.bookStatuses = new BookStatuses(json.bookStatuses)
			this.directory = new Directory(json.directory, this.bookStatuses)
		}
	}
}
