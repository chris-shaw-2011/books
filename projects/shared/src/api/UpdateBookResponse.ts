import ApiMessage from "./ApiMessage"
import Books from "./Books"
import ApiMessageType from "./ApiMessageType"

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
