import User from "../User.js"
import ApiMessage from "./ApiMessage.js"

export default class UserResponse extends ApiMessage {
	override readonly type = "UserResponse"

	user: User

	constructor(json?: Partial<UserResponse>) {
		super()

		this.user = new User(json?.user)
	}
}
