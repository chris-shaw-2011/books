import { type Status } from "../Book.ts"
import ApiMessage from "./ApiMessage.ts"

export default class ChangeBookStatusRequest extends ApiMessage {
	override readonly type = "ChangeBookStatusRequest"

	bookId: string
	status: Status

	constructor(json?: Partial<ChangeBookStatusRequest>) {
		super()

		this.bookId = json?.bookId ?? ""
		this.status = json?.status ?? "Unread"
	}
}
