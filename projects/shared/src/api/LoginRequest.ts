import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class LoginRequest extends ApiMessage {
	override readonly type = "LoginRequest"

	static fromUnknown(json: unknown) {
		return new LoginRequest(typia.assert<ConstructorParameters<typeof LoginRequest>[0]>(json))
	}

	email = ""
	password = ""

	constructor(json?: Partial<LoginRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<LoginRequest>>(json ?? {}))
	}
}
