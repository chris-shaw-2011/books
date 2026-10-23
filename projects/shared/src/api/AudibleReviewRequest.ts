import ApiMessage from "./ApiMessage.ts"

export default class AudibleReviewRequest extends ApiMessage {
	override readonly type = "AudibleReviewRequest"
	sessionId: string
	asin: string

	constructor(json?: Partial<AudibleReviewRequest>) {
		super()
		this.sessionId = json?.sessionId ?? ""
		this.asin = json?.asin ?? ""
	}
}
