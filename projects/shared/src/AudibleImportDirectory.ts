import Directory from "./Directory.ts"
import AudibleImportBook from "./AudibleImportBook.ts"
import type { AudibleImportItem } from "./AudibleImport.ts"

export default class AudibleImportDirectory extends Directory {
	override items: AudibleImportItem[]

	constructor(json?: Partial<AudibleImportDirectory>) {
		super({ ...json, items: [] })
		this.items = json?.items?.map(item => item.type === "Book" ? new AudibleImportBook(item) : new AudibleImportDirectory(item)) ?? []
	}
}
