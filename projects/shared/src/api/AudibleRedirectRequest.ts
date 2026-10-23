import ApiMessage from "./ApiMessage.ts"

export default class AudibleRedirectRequest extends ApiMessage {
	override readonly type = "AudibleRedirectRequest"
	sessionId: string
	redirectUrl: string

	constructor(json?: Partial<AudibleRedirectRequest>) {
		super()
		this.sessionId = json?.sessionId ?? ""
		this.redirectUrl = json?.redirectUrl ?? ""
	}
}
