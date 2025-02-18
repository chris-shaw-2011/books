import Settings from "../Settings.ts"
import ApiMessage from "./ApiMessage.ts"

export default class SettingsUpdate extends ApiMessage {
	override readonly type = "SettingsUpdate"

	settings: Settings

	constructor(json?: Partial<SettingsUpdate>) {
		super()

		this.settings = new Settings(json?.settings)
	}
}