import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class UploadResponse extends ApiMessage {
	conversionId = ""

	constructor(json?: UploadResponse) {
		super(ApiMessageType.UploadResponse)

		if (json) {
			this.conversionId = json.conversionId
		}
	}
}
