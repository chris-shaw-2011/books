import typia from "typia"
import Settings from "../Settings.ts"
import ApiMessage from "./ApiMessage.ts"

export default class SettingsRequired extends ApiMessage {
	override readonly type = "SettingsRequired"

	static fromUnknown(json: unknown) {
		return new SettingsRequired(typia.assert<typia.Primitive<SettingsRequired>>(json))
	}

	message: string
	settings: Settings

	constructor(json?: Partial<SettingsRequired>) {
		const data = json ?? {}
		super()

		this.message = data.message ?? ""
		this.settings = new Settings(data.settings)
	}
}
