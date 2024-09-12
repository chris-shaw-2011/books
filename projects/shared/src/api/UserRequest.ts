import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class UserRequest extends ApiMessage {
	userId = ""

	constructor(json?: UserRequest) {
		super(ApiMessageType.UserRequest)

		if (json) {
			this.userId = json.userId
		}
	}
}
