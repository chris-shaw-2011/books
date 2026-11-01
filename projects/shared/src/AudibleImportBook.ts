import typia from "typia"
import Book from "./Book.ts"
import type LibationBook from "./LibationBook.ts"
import type { BookSeries } from "./Series.ts"

export default class AudibleImportBook extends Book {
	static override fromUnknown(json: unknown) {
		return new AudibleImportBook(typia.assert<typia.Primitive<AudibleImportBook>>(json))
	}

	importStatus: "available" | "skipped" | "queued" | "downloading" | "complete" | "failed" | "cancelled"
	seriesOptions: BookSeries[]
	percentage: number | undefined
	reviewed: boolean
	padding: number

	constructor(json?: Partial<AudibleImportBook> | Partial<typia.Primitive<AudibleImportBook>>) {
		const data = json ?? {}
		super(data)
		this.importStatus = data.importStatus ?? "available"
		this.seriesOptions = data.seriesOptions?.map(series => ({ ...series })) ?? []
		this.percentage = data.percentage
		this.reviewed = data.reviewed ?? false
		this.padding = data.padding ?? 2
		this.id ||= this.asin
	}

	static fromLibation(book: LibationBook): AudibleImportBook {
		if (book.DatePublished !== null && !Number.isFinite(Date.parse(book.DatePublished))) {
			throw new Error("Invalid Libation library export: invalid DatePublished")
		}

		const series = this.parseSeries(book.SeriesOrder)
		const picture = book.PictureId ?? book.PictureLarge

		return new AudibleImportBook({
			asin: book.AudibleProductId,
			name: book.Title,
			cover: picture ? `https://images-na.ssl-images-amazon.com/images/I/${encodeURIComponent(picture)}._SL300_.jpg` : "",
			author: book.AuthorNames,
			narrator: book.NarratorNames,
			comment: book.Description,
			genre: book.CategoriesNames,
			year: book.DatePublished === null ? 0 : new Date(book.DatePublished).getUTCFullYear(),
			duration: book.LengthInMinutes * 60,
			series: series.length === 1 ? series[0]?.name ?? "" : "",
			seriesOrder: series.length === 1 ? series[0]?.order : undefined,
			seriesOptions: series.length > 1 ? series : [],
		})
	}

	private static parseSeries(value: string): BookSeries[] {
		// Libation formats SeriesOrder as "1 : Name, 2 : Other name".
		return value.split(/,\s*(?=[\d.-]+\s*:)/).flatMap(entry => {
			const match = /^\s*([^:]*?)\s*:\s*(.+?)\s*$/.exec(entry)
			if (!match) return []
			const text = match[1]?.trim()
			const order = Number(text)
			return [{ name: match[2] ?? "", order: text && Number.isFinite(order) && order >= 0 ? order : undefined }]
		})
	}

	get seriesChoices(): BookSeries[] {
		return this.seriesOptions.length ? this.seriesOptions : this.series ? [{ name: this.series, order: this.seriesOrder }] : []
	}

	override toJSON() {
		return {
			...super.toJSON(),
			importStatus: this.importStatus,
			seriesOptions: this.seriesOptions,
			percentage: this.percentage,
			reviewed: this.reviewed,
			padding: this.padding,
		}
	}
}
