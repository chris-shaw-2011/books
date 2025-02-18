import Book from "../Book.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UpdateBookRequest extends ApiMessage {
	override readonly type = "UpdateBookRequest"

	newBook: Book
	prevBook: Book

	constructor(json?: Partial<UpdateBookRequest>) {
		super()

		this.newBook = new Book(json?.newBook)
		this.prevBook = new Book(json?.prevBook)
	}
}