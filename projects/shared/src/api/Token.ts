import User from "../User.js"
import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class Token extends ApiMessage {
	user = new User()
	authorization = ""
	checksum = ""

	constructor(json?: Token) {
		super(ApiMessageType.Token)

		if (json) {
			this.user = new User(json.user)
			this.authorization = json.authorization
			this.checksum = json.checksum
		}
	}
}
