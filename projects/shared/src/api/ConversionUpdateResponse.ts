import Book from "../Book.ts"
import { type ConverterStatus } from "../ConverterStatus.ts"
import ApiMessage from "./ApiMessage.ts"

export default class ConversionUpdateResponse extends ApiMessage {
	override readonly type = "ConversionUpdateResponse"

	conversionPercent: number
	errorMessage: string
	converterStatus: ConverterStatus
	book: Book
	fileNames: string[]

	constructor(json?: Partial<ConversionUpdateResponse>) {
		super()

		this.conversionPercent = json?.conversionPercent ?? 0
		this.errorMessage = json?.errorMessage ?? ""
		this.converterStatus = json?.converterStatus ?? "Waiting"
		this.book = new Book(json?.book)
		this.fileNames = json?.fileNames ?? []
	}
}