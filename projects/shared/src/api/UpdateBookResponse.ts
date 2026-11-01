import typia from "typia"
import ApiMessage from "./ApiMessage.ts"
import Books from "./Books.ts"

export default class UpdateBookResponse extends ApiMessage {
	override readonly type = "UpdateBookResponse"

	static fromUnknown(json: unknown) {
		return new UpdateBookResponse(typia.assert<typia.Primitive<UpdateBookResponse>>(json))
	}

	message: string
	books: Books

	constructor(json?: Partial<UpdateBookResponse> | Partial<typia.Primitive<UpdateBookResponse>>) {
		const data = json ?? {}

		super()

		this.message = data.message ?? ""
		this.books = new Books(data.books)
	}
}
