import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class AudibleRedirectRequest extends ApiMessage {
	override readonly type = "AudibleRedirectRequest"

	static fromUnknown(json: unknown) {
		return new AudibleRedirectRequest(typia.assert<ConstructorParameters<typeof AudibleRedirectRequest>[0]>(json))
	}

	sessionId = ""
	redirectUrl = ""

	constructor(json?: Partial<AudibleRedirectRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<AudibleRedirectRequest>>(json ?? {}))
	}
}
