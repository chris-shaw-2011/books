import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class AudibleSessionRequest extends ApiMessage {
	override readonly type = "AudibleSessionRequest"

	static fromUnknown(json: unknown) {
		return new AudibleSessionRequest(typia.assert<ConstructorParameters<typeof AudibleSessionRequest>[0]>(json))
	}

	sessionId = ""

	constructor(json?: Partial<AudibleSessionRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<AudibleSessionRequest>>(json ?? {}))
	}
}
