import typia from "typia"
import Book from "../Book.ts"
import { type ConverterStatus } from "../ConverterStatus.ts"
import ApiMessage from "./ApiMessage.ts"

export default class ConversionUpdateResponse extends ApiMessage {
	override readonly type = "ConversionUpdateResponse"

	static fromUnknown(json: unknown) {
		return new ConversionUpdateResponse(typia.assert<typia.Primitive<ConversionUpdateResponse>>(json))
	}

	conversionPercent: number
	errorMessage: string
	converterStatus: ConverterStatus
	book: Book
	fileNames: string[]

	constructor(json?: Partial<ConversionUpdateResponse> | Partial<typia.Primitive<ConversionUpdateResponse>>) {
		const data = json ?? {}

		super()

		this.conversionPercent = data.conversionPercent ?? 0
		this.errorMessage = data.errorMessage ?? ""
		this.converterStatus = data.converterStatus ?? "Waiting"
		this.book = new Book(data.book)
		this.fileNames = data.fileNames ?? []
	}
}
