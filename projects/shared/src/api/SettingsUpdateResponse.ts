import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class SettingsUpdateResponse extends ApiMessage {
	successful = false
	message = ""

	constructor(json?: SettingsUpdateResponse) {
		super(ApiMessageType.SettingsUpdateResponse)

		if (json) {
			this.successful = json.successful
			this.message = json.message
		}
	}
}
