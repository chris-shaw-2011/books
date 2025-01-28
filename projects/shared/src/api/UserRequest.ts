import ApiMessage from "./ApiMessage.js"

export default class UserRequest extends ApiMessage {
	override readonly type = "UserRequest"

	userId: string

	constructor(json?: Partial<UserRequest>) {
		super()

		this.userId = json?.userId ?? ""
	}
}
