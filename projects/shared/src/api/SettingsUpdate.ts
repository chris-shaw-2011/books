import Settings from "../Settings.js"
import ApiMessage from "./ApiMessage.js"

export default class SettingsUpdate extends ApiMessage {
	override readonly type = "SettingsUpdate"

	settings: Settings

	constructor(json?: Partial<SettingsUpdate>) {
		super()

		this.settings = new Settings(json?.settings)
	}
}
