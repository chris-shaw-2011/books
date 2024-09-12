import { Status } from "../Book.js"
import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

export default class ChangeBookStatusRequest extends ApiMessage {
	token = new Token()
	bookId = ""
	status = Status.Unread

	constructor(json?: ChangeBookStatusRequest) {
		super(ApiMessageType.ChangeBookStatusRequest)

		if (json) {
			this.token = new Token(json.token)
			this.bookId = json.bookId
			this.status = json.status
		}
	}
}
