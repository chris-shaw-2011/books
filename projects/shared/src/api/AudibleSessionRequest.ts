import ApiMessage from "./ApiMessage.ts"

export default class AudibleSessionRequest extends ApiMessage {
	override readonly type = "AudibleSessionRequest"
	sessionId: string

	constructor(json?: Partial<AudibleSessionRequest>) {
		super()
		this.sessionId = json?.sessionId ?? ""
	}
}
