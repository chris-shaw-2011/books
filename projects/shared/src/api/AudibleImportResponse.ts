import Book from "../Book.ts"
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
		return { ...snapshot, reviewQueue: snapshot.reviewQueue.map(item => new Book(item)) }
	}
}
