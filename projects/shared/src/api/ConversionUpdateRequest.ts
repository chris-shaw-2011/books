import { type ConverterStatus } from "../ConverterStatus.ts"
import ApiMessage from "./ApiMessage.ts"

export default class ConversionUpdateRequest extends ApiMessage {
	override readonly type = "ConversionUpdateRequest"

	knownPercent: number
	knownConverterStatus: ConverterStatus
	conversionId: string
	knownWorkingFiles: string[]

	constructor(json?: Partial<ConversionUpdateRequest>) {
		super()

		this.knownPercent = json?.knownPercent ?? 0
		this.conversionId = json?.conversionId ?? ""
		this.knownConverterStatus = json?.knownConverterStatus ?? "Waiting"
		this.knownWorkingFiles = json?.knownWorkingFiles ?? []
	}
}