import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class AccessDenied extends ApiMessage {
	message = ""

	constructor(json?: AccessDenied) {
		super(ApiMessageType.AccessDenied)

		if (json) {
			this.message = json.message
		}
	}
}
