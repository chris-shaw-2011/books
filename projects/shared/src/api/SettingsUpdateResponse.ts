import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

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
