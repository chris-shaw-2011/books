import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class SettingsUpdateResponse extends ApiMessage {
	override readonly type = "SettingsUpdateResponse"

	static fromUnknown(json: unknown) {
		return new SettingsUpdateResponse(typia.assert<typia.Primitive<SettingsUpdateResponse>>(json))
	}

	successful = false
	message = ""

	constructor(json?: Partial<SettingsUpdateResponse>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<SettingsUpdateResponse>>(json ?? {}))
	}
}
