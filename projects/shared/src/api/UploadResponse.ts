import ApiMessage from "./ApiMessage.ts"

export default class UploadResponse extends ApiMessage {
	override readonly type = "UploadResponse"

	conversionId: string

	constructor(json?: Partial<UploadResponse>) {
		super()

		this.conversionId = json?.conversionId ?? ""
	}
}