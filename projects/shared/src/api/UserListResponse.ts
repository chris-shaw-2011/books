import User from "../User.js"
import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class UserListResponse extends ApiMessage {
	users: User[] = []
	message = ""

	constructor(json?: UserListResponse) {
		super(ApiMessageType.UserListResponse)

		if (json) {
			this.users = json.users.map(u => new User(u))
			this.message = json.message
		}
	}
}
