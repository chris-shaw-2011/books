import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class AddUserRequest extends ApiMessage {
	override readonly type = "AddUserRequest"

	user: User

	constructor(json: Partial<AddUserRequest>) {
		super()

		this.user = new User(json.user)
	}
}
