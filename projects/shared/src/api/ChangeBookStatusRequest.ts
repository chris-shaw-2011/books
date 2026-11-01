import typia from "typia"
import { type Status } from "../Book.ts"
import ApiMessage from "./ApiMessage.ts"

export default class ChangeBookStatusRequest extends ApiMessage {
	override readonly type = "ChangeBookStatusRequest"

	static fromUnknown(json: unknown) {
		return new ChangeBookStatusRequest(typia.assert<ConstructorParameters<typeof ChangeBookStatusRequest>[0]>(json))
	}

	bookId = ""
	status: Status = "Unread"

	constructor(json?: Partial<ChangeBookStatusRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<ChangeBookStatusRequest>>(json ?? {}))
	}
}
