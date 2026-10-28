import AudibleImportBook from "../AudibleImportBook.ts"
import AudibleImportDirectory from "../AudibleImportDirectory.ts"
import type { AudibleImportSnapshot } from "../AudibleImport.ts"
import ApiMessage from "./ApiMessage.ts"

export default class AudibleImportResponse extends ApiMessage {
	override readonly type = "AudibleImportResponse"

	snapshot?: AudibleImportSnapshot | undefined
	errorMessage?: string

	constructor(json?: Partial<AudibleImportResponse>) {
		super()

		if (json?.snapshot) this.snapshot = AudibleImportResponse.restoreSnapshot(json.snapshot)
		if (json?.errorMessage) this.errorMessage = json.errorMessage
	}

	static restoreSnapshot(snapshot: AudibleImportSnapshot): AudibleImportSnapshot {
		return { ...snapshot, books: snapshot.books.map(item => item.type === "Book" ? new AudibleImportBook(item) : new AudibleImportDirectory(item)) }
	}
}
