import Settings from "../Settings.ts"
import ApiMessage from "./ApiMessage.ts"

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
