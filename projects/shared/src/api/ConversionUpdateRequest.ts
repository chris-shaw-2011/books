import typia from "typia"
import { type ConverterStatus } from "../ConverterStatus.ts"
import ApiMessage from "./ApiMessage.ts"

export default class ConversionUpdateRequest extends ApiMessage {
	override readonly type = "ConversionUpdateRequest"

	static fromUnknown(json: unknown) {
		return new ConversionUpdateRequest(typia.assert<ConstructorParameters<typeof ConversionUpdateRequest>[0]>(json))
	}

	knownPercent = 0
	knownConverterStatus: ConverterStatus = "Waiting"
	conversionId = ""
	knownWorkingFiles: string[] = []

	constructor(json?: Partial<ConversionUpdateRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<ConversionUpdateRequest>>(json ?? {}))
	}
}
