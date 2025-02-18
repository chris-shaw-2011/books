import ApiMessage from "./ApiMessage.ts"
import Books from "./Books.ts"

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