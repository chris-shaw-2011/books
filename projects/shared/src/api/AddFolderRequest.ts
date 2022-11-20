import ApiMessage from "./ApiMessage"
import Token from "./Token"
import ApiMessageType from "./ApiMessageType"

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
