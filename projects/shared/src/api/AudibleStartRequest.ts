import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class AudibleStartRequest extends ApiMessage {
	override readonly type = "AudibleStartRequest"

	static fromUnknown(json: unknown) {
		return new AudibleStartRequest(typia.assert<ConstructorParameters<typeof AudibleStartRequest>[0]>(json))
	}

	account = ""
	marketplace = ""

	constructor(json?: Partial<AudibleStartRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<AudibleStartRequest>>(json ?? {}))
	}
}
