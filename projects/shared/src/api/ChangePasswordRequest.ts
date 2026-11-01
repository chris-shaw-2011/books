import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class ChangePasswordRequest extends ApiMessage {
	override readonly type = "ChangePasswordRequest"

	static fromUnknown(json: unknown) {
		return new ChangePasswordRequest(typia.assert<ConstructorParameters<typeof ChangePasswordRequest>[0]>(json))
	}

	newPassword = ""

	constructor(json?: Partial<ChangePasswordRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<ChangePasswordRequest>>(json ?? {}))
	}
}
