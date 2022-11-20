import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class UserRequest extends ApiMessage {
	userId = ""

	constructor(json?: UserRequest) {
		super(ApiMessageType.UserRequest)

		if (json) {
			this.userId = json.userId
		}
	}
}
