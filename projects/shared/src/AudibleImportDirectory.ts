import typia from "typia"
import Directory from "./Directory.ts"
import AudibleImportBook from "./AudibleImportBook.ts"
import type { AudibleImportItem } from "./AudibleImport.ts"

export default class AudibleImportDirectory extends Directory {
	static override fromUnknown(json: unknown) {
		return new AudibleImportDirectory(typia.assert<typia.Primitive<AudibleImportDirectory>>(json))
	}

	override items: AudibleImportItem[]

	constructor(json?: Partial<AudibleImportDirectory> | Partial<typia.Primitive<AudibleImportDirectory>>) {
		const data = json ?? {}

		super({ ...data, items: [] })
		this.items = data.items?.map(item => item.type === "Book" ? new AudibleImportBook(item) : new AudibleImportDirectory(item)) ?? []
	}

	override toJSON() {
		return { ...super.toJSON(), items: this.items }
	}
}
