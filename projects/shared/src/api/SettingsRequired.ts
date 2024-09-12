import Settings from "../Settings.js"
import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class SettingsRequired extends ApiMessage {
	message = ""
	settings = new Settings()

	constructor(json?: SettingsRequired) {
		super(ApiMessageType.SettingsRequired)

		if (json) {
			this.message = json.message
			this.settings = new Settings(json.settings)
		}
	}
}
