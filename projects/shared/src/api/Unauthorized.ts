import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class Unauthorized extends ApiMessage {
	message = ""

	constructor(json?: Unauthorized) {
		super(ApiMessageType.Unauthorized)

		if (json) {
			this.message = json.message
		}
	}
}
