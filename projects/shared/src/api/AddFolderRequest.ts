import ApiMessage from "./ApiMessage.js"
import Token from "./Token.js"
import ApiMessageType from "./ApiMessageType.js"

export default class AddFolderRequest extends ApiMessage {
	path = ""
	folderName = ""
	token = new Token()

	constructor(json?: AddFolderRequest) {
		super(ApiMessageType.AddFolderRequest)

		if (json) {
			this.path = json.path
			this.folderName = json.folderName
			this.token = new Token(json.token)
		}
	}
}
