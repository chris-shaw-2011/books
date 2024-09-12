import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

export default class ChangePasswordRequest extends ApiMessage {
	newPassword = ""
	token = new Token()

	constructor(json?: ChangePasswordRequest) {
		super(ApiMessageType.ChangePasswordRequest)

		if (json) {
			this.newPassword = json.newPassword
			this.token = new Token(json.token)
		}
	}
}
