import { AudibleImportDirectory, type AudibleImportItem } from "@books/shared"

export function filterImportedBooks(items: readonly AudibleImportItem[]): AudibleImportItem[] {
	return items.flatMap((item): AudibleImportItem[] => {
		if (item.type === "Book") return item.importStatus === "skipped" ? [] : [item]
		const children = filterImportedBooks(item.items)
		if (children.length === 0) return []
		return [Object.assign(new AudibleImportDirectory(), item, { items: children })]
	})
}
