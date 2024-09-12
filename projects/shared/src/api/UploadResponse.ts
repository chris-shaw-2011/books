import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class UploadResponse extends ApiMessage {
	conversionId = ""

	constructor(json?: UploadResponse) {
		super(ApiMessageType.UploadResponse)

		if (json) {
			this.conversionId = json.conversionId
		}
	}
}
