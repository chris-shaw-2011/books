import Settings from "../Settings"
import ApiMessage from "./ApiMessage"
import Token from "./Token"
import ApiMessageType from "./ApiMessageType"

export default class SettingsUpdate extends ApiMessage {
	settings = new Settings()
	token = new Token()

	constructor(json?: SettingsUpdate) {
		super(ApiMessageType.SettingsUpdate)

		if (json) {
			this.settings = new Settings(json.settings)
			this.token = new Token(json.token)
		}
	}
}
