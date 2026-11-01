import typia from "typia"
import Book from "../Book.ts"
import ApiMessage from "./ApiMessage.ts"

export default class UpdateBookRequest extends ApiMessage {
	override readonly type = "UpdateBookRequest"

	static fromUnknown(json: unknown) {
		return new UpdateBookRequest(typia.assert<ConstructorParameters<typeof UpdateBookRequest>[0]>(json))
	}

	newBook: Book

	constructor(json?: Partial<UpdateBookRequest> | Partial<typia.Primitive<UpdateBookRequest>>) {
		const data = json ?? {}

		super()

		// Trim any spaces when doing an UpdateBookRequest
		const book = typia.plain.clone<Partial<Book> | Partial<typia.Primitive<Book>>>(data.newBook ?? {})
		const trimmedNewBook = {
			...book,
			...Object.fromEntries(Object.entries(book)
				.map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])),
		}

		this.newBook = new Book(trimmedNewBook)
	}
}
