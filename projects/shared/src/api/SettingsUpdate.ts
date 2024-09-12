import Settings from "../Settings.js"
import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

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
