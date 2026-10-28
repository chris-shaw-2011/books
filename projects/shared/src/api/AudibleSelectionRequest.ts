import ApiMessage from "./ApiMessage.ts"
import type { SeriesOrganization } from "../Series.ts"

export default class AudibleSelectionRequest extends ApiMessage {
	override readonly type = "AudibleSelectionRequest"
	sessionId: string
	asins: string[]
	organizations?: Record<string, SeriesOrganization>

	constructor(json?: Partial<AudibleSelectionRequest>) {
		super()
		this.sessionId = json?.sessionId ?? ""
		this.asins = json?.asins ?? []
		if (json?.organizations) this.organizations = json.organizations
	}
}
