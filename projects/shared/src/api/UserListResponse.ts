import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UserListResponse extends ApiMessage {
	override readonly type = "UserListResponse"

	users: User[]
	message: string

	constructor(json?: Partial<UserListResponse>) {
		super()

		this.users = json?.users?.map(u => new User(u)) ?? []
		this.message = json?.message ?? ""
	}
}