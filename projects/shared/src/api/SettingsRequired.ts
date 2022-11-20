import Settings from "../Settings"
import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

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
