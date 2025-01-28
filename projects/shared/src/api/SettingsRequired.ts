import Settings from "../Settings.js"
import ApiMessage from "./ApiMessage.js"

export default class SettingsRequired extends ApiMessage {
	override readonly type = "SettingsRequired"

	message: string
	settings: Settings

	constructor(json?: Partial<SettingsRequired>) {
		super()

		this.message = json?.message ?? ""
		this.settings = new Settings(json?.settings)
	}
}
