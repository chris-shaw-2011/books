import Book from "../Book.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UpdateBookRequest extends ApiMessage {
	override readonly type = "UpdateBookRequest"

	newBook: Book
	prevBook: Book

	constructor(json?: Partial<UpdateBookRequest>) {
		super()

		// Trim any spaces when doing an UpdateBookRequest
		let trimmedNewBook = json?.newBook

		if (trimmedNewBook) {
			trimmedNewBook = Object.fromEntries(
				Object.entries(trimmedNewBook)
					.map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
			) as typeof trimmedNewBook
		}

		this.newBook = new Book(trimmedNewBook)
		this.prevBook = new Book(json?.prevBook)
	}
}
