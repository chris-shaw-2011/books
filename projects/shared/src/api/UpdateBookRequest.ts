import Book from "../Book.js"
import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

export default class UpdateBookRequest extends ApiMessage {
	token = new Token()
	newBook = new Book()
	prevBook = new Book()

	constructor(json?: UpdateBookRequest) {
		super(ApiMessageType.UpdateBookRequest)

		if (json) {
			this.token = new Token(json.token)
			this.newBook = new Book(json.newBook)
			this.prevBook = new Book(json.prevBook)
		}
	}
}
