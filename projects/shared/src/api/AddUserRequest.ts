import User from "../User"
import ApiMessage from "./ApiMessage"
import Token from "./Token"
import ApiMessageType from "./ApiMessageType"

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
