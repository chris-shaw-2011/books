import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class UserRequest extends ApiMessage {
	override readonly type = "UserRequest"

	static fromUnknown(json: unknown) {
		return new UserRequest(typia.assert<ConstructorParameters<typeof UserRequest>[0]>(json))
	}

	userId = ""

	constructor(json?: Partial<UserRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<UserRequest>>(json ?? {}))
	}
}
