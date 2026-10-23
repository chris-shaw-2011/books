import ApiMessage from "./ApiMessage.ts"

export default class AudibleStartRequest extends ApiMessage {
	override readonly type = "AudibleStartRequest"
	account: string
	marketplace: string

	constructor(json?: Partial<AudibleStartRequest>) {
		super()
		this.account = json?.account ?? ""
		this.marketplace = json?.marketplace ?? ""
	}
}
