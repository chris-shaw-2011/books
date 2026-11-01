import typia from "typia"
import BookStatuses from "../BookStatuses.ts"
import Directory from "../Directory.ts"
import ApiMessage from "./ApiMessage.ts"

export default class Books extends ApiMessage {
	override readonly type = "Books"

	static fromUnknown(json: unknown) {
		return new Books(typia.assert<typia.Primitive<Books>>(json))
	}

	directory: Directory
	bookStatuses: BookStatuses
	missingSettings: boolean

	constructor(json?: Partial<Books> | Partial<typia.Primitive<Books>>) {
		const data = json ?? {}

		super()

		this.bookStatuses = new BookStatuses(data.bookStatuses)
		this.directory = new Directory(data.directory, this.bookStatuses)
		this.missingSettings = data.missingSettings ?? false
	}
}
