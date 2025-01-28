import ApiMessage from "./ApiMessage.js"
import Books from "./Books.js"

export default class UpdateBookResponse extends ApiMessage {
	override readonly type = "UpdateBookResponse"

	message: string
	books: Books

	constructor(json?: Partial<UpdateBookResponse>) {
		super()

		this.message = json?.message ?? ""
		this.books = new Books(json?.books)
	}
}
