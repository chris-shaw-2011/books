import typia from "typia"
import ApiMessage from "./ApiMessage.ts"
import type { SeriesOrganization } from "../Series.ts"

export default class AudibleSelectionRequest extends ApiMessage {
	override readonly type = "AudibleSelectionRequest"

	static fromUnknown(json: unknown) {
		return new AudibleSelectionRequest(typia.assert<ConstructorParameters<typeof AudibleSelectionRequest>[0]>(json))
	}

	sessionId = ""
	asins: string[] = []
	organizations?: Record<string, SeriesOrganization>

	constructor(json?: Partial<AudibleSelectionRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<AudibleSelectionRequest>>(json ?? {}))
	}
}
