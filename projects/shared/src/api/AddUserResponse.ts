import typia from "typia"
import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class AddUserResponse extends ApiMessage {
	override readonly type = "AddUserResponse"

	static fromUnknown(json: unknown) {
		return new AddUserResponse(typia.assert<typia.Primitive<AddUserResponse>>(json))
	}

	successful: boolean
	users: User[]
	message: string

	constructor(json?: Partial<AddUserResponse> | Partial<typia.Primitive<AddUserResponse>>) {
		const data = json ?? {}

		super()

		this.successful = data.successful ?? false
		this.users = data.users?.map(u => new User(u)) ?? []
		this.message = data.message ?? ""
	}
}
