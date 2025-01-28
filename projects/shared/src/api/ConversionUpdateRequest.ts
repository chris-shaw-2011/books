import { type ConverterStatus } from "../ConverterStatus.js"
import ApiMessage from "./ApiMessage.js"

export default class ConversionUpdateRequest extends ApiMessage {
	override readonly type = "ConversionUpdateRequest"

	knownPercent: number
	knownConverterStatus: ConverterStatus
	conversionId: string

	constructor(json?: Partial<ConversionUpdateRequest>) {
		super()

		this.knownPercent = json?.knownPercent ?? 0
		this.conversionId = json?.conversionId ?? ""
		this.knownConverterStatus = json?.knownConverterStatus ?? "Waiting"
	}
}
