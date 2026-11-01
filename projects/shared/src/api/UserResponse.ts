import typia from "typia"
import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UserResponse extends ApiMessage {
	override readonly type = "UserResponse"

	static fromUnknown(json: unknown) {
		return new UserResponse(typia.assert<typia.Primitive<UserResponse>>(json))
	}

	user: User

	constructor(json?: Partial<UserResponse> | Partial<typia.Primitive<UserResponse>>) {
		const data = json ?? {}
		super()

		this.user = new User(data.user)
	}
}
