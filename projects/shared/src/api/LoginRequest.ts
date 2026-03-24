import ApiMessage from "./ApiMessage.ts"

export default class LoginRequest extends ApiMessage {
	override readonly type = "LoginRequest"

	email: string
	password: string

	constructor(json?: Partial<LoginRequest>) {
		super()

		this.email = json?.email ?? ""
		this.password = json?.password ?? ""
	}
}
