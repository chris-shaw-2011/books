import { ConverterStatus } from "../ConverterStatus.js"
import ApiMessage from "./ApiMessage.js"
import ApiMessageType from "./ApiMessageType.js"

export default class ConversionUpdateRequest extends ApiMessage {
	knownPercent = 0
	knownConverterStatus = ConverterStatus.Waiting
	conversionId = ""

	constructor(json?: ConversionUpdateRequest) {
		super(ApiMessageType.ConversionUpdateRequest)

		if (json) {
			this.knownPercent = json.knownPercent
			this.conversionId = json.conversionId
			this.knownConverterStatus = json.knownConverterStatus
		}
	}
}
