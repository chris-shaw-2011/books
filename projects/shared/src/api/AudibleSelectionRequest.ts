import ApiMessage from "./ApiMessage.ts"

export default class AudibleSelectionRequest extends ApiMessage {
	override readonly type = "AudibleSelectionRequest"
	sessionId: string
	asins: string[]

	constructor(json?: Partial<AudibleSelectionRequest>) {
		super()
		this.sessionId = json?.sessionId ?? ""
		this.asins = json?.asins ?? []
	}
}
