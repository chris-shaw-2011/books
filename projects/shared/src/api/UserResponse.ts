import User from "../User.js"
import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class UserResponse extends ApiMessage {
	user = new User()

	constructor(json?: UserResponse) {
		super(ApiMessageType.UserResponse)

		if (json) {
			this.user = new User(json.user)
		}
	}
}
