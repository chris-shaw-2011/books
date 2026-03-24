import BookStatuses from "../BookStatuses.ts"
import Directory from "../Directory.ts"
import ApiMessage from "./ApiMessage.ts"

export default class Books extends ApiMessage {
	override readonly type = "Books"

	directory: Directory
	bookStatuses: BookStatuses
	missingSettings: boolean

	constructor(json?: Partial<Books>) {
		super()

		this.bookStatuses = new BookStatuses(json?.bookStatuses)
		this.directory = new Directory(json?.directory, this.bookStatuses)
		this.missingSettings = json?.missingSettings ?? false
	}
}
