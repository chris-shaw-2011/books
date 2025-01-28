import User from "../User.js"
import ApiMessage from "./ApiMessage.js"

export default class AddUserRequest extends ApiMessage {
	override readonly type = "AddUserRequest"

	user: User

	constructor(json: Partial<AddUserRequest>) {
		super()

		this.user = new User(json.user)
	}
}
