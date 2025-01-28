import Book from "../Book.js"
import ApiMessage from "./ApiMessage.js"

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
