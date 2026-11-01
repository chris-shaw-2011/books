import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class DeleteUserRequest extends ApiMessage {
	override readonly type = "DeleteUserRequest"

	static fromUnknown(json: unknown) {
		return new DeleteUserRequest(typia.assert<ConstructorParameters<typeof DeleteUserRequest>[0]>(json))
	}

	userId = ""

	constructor(json?: Partial<DeleteUserRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<DeleteUserRequest>>(json ?? {}))
	}
}
