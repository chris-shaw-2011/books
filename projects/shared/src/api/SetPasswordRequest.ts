import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class SetPasswordRequest extends ApiMessage {
	override readonly type = "SetPasswordRequest"

	static fromUnknown(json: unknown) {
		return new SetPasswordRequest(typia.assert<ConstructorParameters<typeof SetPasswordRequest>[0]>(json))
	}

	userId = ""
	newPassword = ""

	constructor(json?: Partial<SetPasswordRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<SetPasswordRequest>>(json ?? {}))
	}
}
