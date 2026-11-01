import typia from "typia"
import type { ConverterStatus } from "../ConverterStatus.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UploadResponse extends ApiMessage {
	override readonly type = "UploadResponse"

	static fromUnknown(json: unknown) {
		return new UploadResponse(typia.assert<typia.Primitive<UploadResponse>>(json))
	}

	conversionId = ""
	converterStatus: ConverterStatus = "Waiting"

	constructor(json?: Partial<UploadResponse>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<UploadResponse>>(json ?? {}))
	}
}
