import { AudibleImportBook, AudibleImportDirectory, seriesBookTitle, suggestSeriesOrganization, type Directory, type AudibleImportItem } from "@books/shared"

export default function selectionItems(books: readonly AudibleImportBook[], library: Directory): AudibleImportItem[] {
	const root = new AudibleImportDirectory()
	for (const source of books) {
		const book = new AudibleImportBook(source)
		const series = source.seriesChoices[0]
		const destination = series && suggestSeriesOrganization(series, library)
		const organization = source.seriesChoices.length === 1 ? destination : undefined
		if (organization) {
			book.folderPath = organization.folderPath
			book.padding = organization.padding
			book.series = organization.series.name
			book.seriesOrder = organization.series.order
			if (book.seriesOrder !== undefined) book.name = seriesBookTitle(book.name, book.seriesOrder, organization.padding)
		}
		const folders = destination ? destination.folderPath.split("/").filter(Boolean) : series ? [series.name] : []
		let directory = root
		for (const name of folders) {
			const folderPath = `${directory.folderPath}/${name}`
			let folder = directory.items.find((item): item is AudibleImportDirectory => item.type === "Directory" && item.folderPath === folderPath)
			if (!folder) {
				folder = new AudibleImportDirectory({ id: `audible:${folderPath}`, name, folderPath, hasBooks: true })
				directory.items.push(folder)
			}
			directory = folder
		}
		directory.items.push(book)
	}
	return root.items
}
