import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class AudibleReviewRequest extends ApiMessage {
	override readonly type = "AudibleReviewRequest"

	static fromUnknown(json: unknown) {
		return new AudibleReviewRequest(typia.assert<ConstructorParameters<typeof AudibleReviewRequest>[0]>(json))
	}

	sessionId = ""
	asin = ""

	constructor(json?: Partial<AudibleReviewRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<AudibleReviewRequest>>(json ?? {}))
	}
}
