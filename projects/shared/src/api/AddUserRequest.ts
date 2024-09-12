import User from "../User.js"
import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

export default class AddUserRequest extends ApiMessage {
	user = new User()
	token = new Token()

	constructor(json?: AddUserRequest) {
		super(ApiMessageType.AddUserRequest)

		if (json) {
			this.user = new User(json.user)
			this.token = new Token(json.token)
		}
	}
}
