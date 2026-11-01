import typia from "typia"
import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UserListResponse extends ApiMessage {
	override readonly type = "UserListResponse"

	static fromUnknown(json: unknown) {
		return new UserListResponse(typia.assert<typia.Primitive<UserListResponse>>(json))
	}

	users: User[]
	message: string

	constructor(json?: Partial<UserListResponse> | Partial<typia.Primitive<UserListResponse>>) {
		const data = json ?? {}
		super()

		this.users = data.users?.map(u => new User(u)) ?? []
		this.message = data.message ?? ""
	}
}
