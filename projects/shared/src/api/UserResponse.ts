import User from "../User"
import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class UserResponse extends ApiMessage {
	user = new User()

	constructor(json?: UserResponse) {
		super(ApiMessageType.UserResponse)

		if (json) {
			this.user = new User(json.user)
		}
	}
}
