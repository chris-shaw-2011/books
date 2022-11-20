import Book from "../Book"
import { ConverterStatus } from "../ConverterStatus"
import ApiMessage from "./ApiMessage"
import ApiMessageType from "./ApiMessageType"

export default class ConversionUpdateResponse extends ApiMessage {
	conversionPercent = 0
	errorMessage = ""
	converterStatus = ConverterStatus.Waiting
	book?: Book

	constructor(json?: ConversionUpdateResponse) {
		super(ApiMessageType.ConversionUpdateResponse)

		if (json) {
			this.conversionPercent = json.conversionPercent
			this.errorMessage = json.errorMessage
			this.converterStatus = json.converterStatus

			if (json.book) {
				this.book = new Book(json.book)
			}
		}
	}
}
