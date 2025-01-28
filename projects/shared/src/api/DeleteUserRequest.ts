import ApiMessage from "./ApiMessage.js"

export default class DeleteUserRequest extends ApiMessage {
	override readonly type = "DeleteUserRequest"

	userId: string

	constructor(json?: Partial<DeleteUserRequest>) {
		super()

		this.userId = json?.userId ?? ""
	}
}
