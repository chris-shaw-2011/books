import { Status } from "../Book"
import ApiMessage from "./ApiMessage"
import Token from "./Token"
import ApiMessageType from "./ApiMessageType"

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
