import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class AddUserResponse extends ApiMessage {
	override readonly type = "AddUserResponse"

	successful: boolean
	users: User[]
	message: string

	constructor(json?: Partial<AddUserResponse>) {
		super()

		this.successful = json?.successful ?? false
		this.users = json?.users ?? []
		this.message = json?.message ?? ""
	}
}
