import ApiMessage from "./ApiMessage.ts"

export default class ChangePasswordRequest extends ApiMessage {
	override readonly type = "ChangePasswordRequest"

	newPassword: string

	constructor(json?: Partial<ChangePasswordRequest>) {
		super()

		this.newPassword = json?.newPassword ?? ""
	}
}