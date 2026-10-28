import type Directory from "./Directory.ts"

export interface BookSeries {
	name: string,
	order: number | undefined,
}

export interface SeriesOrganization {
	folderPath: string,
	series: BookSeries & { order: number },
	padding: number,
}

export const unnumberedTitle = (title: string) => title.replace(/^\d+(?:\.\d+)?\s+-\s+/, "")

export function seriesBookTitle(title: string, seriesOrder: number, padding = 2) {
	const order = seriesOrder.toLocaleString("en-US", { useGrouping: false, minimumIntegerDigits: padding, maximumFractionDigits: 20 })
	return `${order} - ${unnumberedTitle(title)}`
}

const normalizedSeries = (name: string) => name.normalize("NFKC").toLowerCase().replace(/\s+(?:series|trilogy)$/i, "").replace(/[^\p{L}\p{N}]/gu, "")

// Shared by import review, book editing, and the Upload migration script.
export function suggestSeriesOrganization(series: BookSeries, root: Directory) {
	const matches: Directory[] = []
	const visit = (directory: Directory) => {
		for (const item of directory.items) {
			if (item.type !== "Directory") continue
			if (normalizedSeries(item.name) === normalizedSeries(series.name) || item.items.some(book => book.type === "Book" && book.series && book.seriesOrder !== undefined && unnumberedTitle(book.name) !== book.name && normalizedSeries(book.series) === normalizedSeries(series.name))) matches.push(item)
			visit(item)
		}
	}
	visit(root)
	if (matches.length > 1 || !series.name.trim()) return
	const existing = matches[0]
	const numbers = existing?.items.flatMap(item => {
		const number = /^(\d+)(?:\.\d+)?\s+-\s+/.exec(item.name)?.[1]
		return number ? [number] : []
	}) ?? []
	// Use existing zero-padding when available, otherwise two digits.
	const padded = numbers.filter(number => number.length > 1 && number.startsWith("0"))
	const padding = padded.length ? Math.max(...padded.map(number => number.length)) : numbers.length ? 1 : 2
	// eslint-disable-next-line no-control-regex -- Strip filesystem control characters from metadata.
	const folderName = series.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/[. ]+$/, "").trim()
	if (!folderName || folderName === "." || folderName === "..") return
	return { folderPath: existing?.folderPath ?? `/${folderName}`, series, padding }
}
