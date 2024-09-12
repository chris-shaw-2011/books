import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

export default class DeleteUserRequest extends ApiMessage {
	userId = ""
	token = new Token()

	constructor(json?: DeleteUserRequest) {
		super(ApiMessageType.DeleteUserRequest)

		if (json) {
			this.userId = json.userId
			this.token = new Token(json.token)
		}
	}
}
