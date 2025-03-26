import type { ConverterStatus } from "../ConverterStatus.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UploadResponse extends ApiMessage {
	override readonly type = "UploadResponse"

	conversionId: string
	converterStatus: ConverterStatus

	constructor(json?: Partial<UploadResponse>) {
		super()

		this.conversionId = json?.conversionId ?? ""
		this.converterStatus = json?.converterStatus ?? "Waiting"
	}
}