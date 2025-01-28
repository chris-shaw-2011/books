import Book from "../Book.js"
import { type ConverterStatus } from "../ConverterStatus.js"
import ApiMessage from "./ApiMessage.js"

export default class ConversionUpdateResponse extends ApiMessage {
	override readonly type = "ConversionUpdateResponse"

	conversionPercent: number
	errorMessage: string
	converterStatus: ConverterStatus
	book: Book

	constructor(json?: Partial<ConversionUpdateResponse>) {
		super()

		this.conversionPercent = json?.conversionPercent ?? 0
		this.errorMessage = json?.errorMessage ?? ""
		this.converterStatus = json?.converterStatus ?? "Waiting"
		this.book = new Book(json?.book)
	}
}
