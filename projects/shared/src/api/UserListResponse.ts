import User from "../User"
import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class UserListResponse extends ApiMessage {
	users = new Array<User>()
	message = ""

	constructor(json?: UserListResponse) {
		super(ApiMessageType.UserListResponse)

		if (json) {
			this.users = json.users.map(u => new User(u))
			this.message = json.message
		}
	}
}
