import { type Status } from "../Book.js"
import ApiMessage from "./ApiMessage.js"

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
