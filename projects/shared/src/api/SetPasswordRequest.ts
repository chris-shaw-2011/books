import ApiMessage from "./ApiMessage.ts"

export default class SetPasswordRequest extends ApiMessage {
	override readonly type = "SetPasswordRequest"

	userId: string
	newPassword: string

	constructor(json?: Partial<SetPasswordRequest>) {
		super()

		this.newPassword = json?.newPassword ?? ""
		this.userId = json?.userId ?? ""
	}
}
