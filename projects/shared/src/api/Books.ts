import BookStatuses from "../BookStatuses.js"
import Directory from "../Directory.js"
import ApiMessage from "./ApiMessage.js"

export default class Books extends ApiMessage {
	override readonly type = "Books"

	directory: Directory
	bookStatuses: BookStatuses

	constructor(json?: Partial<Books>) {
		super()

		this.bookStatuses = new BookStatuses(json?.bookStatuses)
		this.directory = new Directory(json?.directory, this.bookStatuses)
	}
}
