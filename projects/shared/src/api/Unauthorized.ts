import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class Unauthorized extends ApiMessage {
	message = ""

	constructor(json?: Unauthorized) {
		super(ApiMessageType.Unauthorized)

		if (json) {
			this.message = json.message
		}
	}
}
