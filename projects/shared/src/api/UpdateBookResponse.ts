import ApiMessage from "./ApiMessage.js"
import Books from "./Books.js"
import ApiMessageType from "./ApiMessageType.js"

export default class UpdateBookResponse extends ApiMessage {
	message = ""
	books?: Books

	constructor(json?: UpdateBookResponse) {
		super(ApiMessageType.UpdateBookResponse)

		if (json) {
			this.message = json.message
			this.books = json.books ? new Books(json.books) : undefined
		}
	}
}
