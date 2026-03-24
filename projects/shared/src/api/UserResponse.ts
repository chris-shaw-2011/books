import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UserResponse extends ApiMessage {
	override readonly type = "UserResponse"

	user: User

	constructor(json?: Partial<UserResponse>) {
		super()

		this.user = new User(json?.user)
	}
}
