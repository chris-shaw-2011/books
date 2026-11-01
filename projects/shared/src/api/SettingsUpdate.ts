import typia from "typia"
import Settings from "../Settings.ts"
import ApiMessage from "./ApiMessage.ts"

export default class SettingsUpdate extends ApiMessage {
	override readonly type = "SettingsUpdate"

	static fromUnknown(json: unknown) {
		return new SettingsUpdate(typia.assert<ConstructorParameters<typeof SettingsUpdate>[0]>(json))
	}

	settings: Settings

	constructor(json?: Partial<SettingsUpdate>) {
		const data = json ?? {}

		super()

		this.settings = new Settings(data.settings)
	}
}
