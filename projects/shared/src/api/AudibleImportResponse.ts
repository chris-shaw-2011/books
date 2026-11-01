import typia from "typia"
import AudibleImportBook from "../AudibleImportBook.ts"
import AudibleImportDirectory from "../AudibleImportDirectory.ts"
import type { AudibleImportSnapshot } from "../AudibleImport.ts"
import ApiMessage from "./ApiMessage.ts"

export default class AudibleImportResponse extends ApiMessage {
	override readonly type = "AudibleImportResponse"

	static fromUnknown(json: unknown) {
		return new AudibleImportResponse(typia.assert<typia.Primitive<AudibleImportResponse>>(json))
	}

	snapshot?: AudibleImportSnapshot | undefined
	errorMessage?: string

	constructor(json?: Partial<AudibleImportResponse> | Partial<typia.Primitive<AudibleImportResponse>>) {
		const data = json ?? {}
		super()

		if (data.snapshot) this.snapshot = AudibleImportResponse.restoreSnapshot(data.snapshot)
		if (data.errorMessage) this.errorMessage = data.errorMessage
	}

	static snapshotFromUnknown(json: unknown): AudibleImportSnapshot {
		return this.restoreSnapshot(typia.assert<typia.Primitive<AudibleImportSnapshot>>(json))
	}

	static restoreSnapshot(snapshot: AudibleImportSnapshot | typia.Primitive<AudibleImportSnapshot>): AudibleImportSnapshot {
		return { ...snapshot, books: snapshot.books.map(item => item.type === "Book" ? new AudibleImportBook(item) : new AudibleImportDirectory(item)) }
	}
}
