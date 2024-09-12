import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class AccessDenied extends ApiMessage {
	message = ""

	constructor(json?: AccessDenied) {
		super(ApiMessageType.AccessDenied)

		if (json) {
			this.message = json.message
		}
	}
}
