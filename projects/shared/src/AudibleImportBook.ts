import Book from "./Book.ts"
import type { BookSeries } from "./Series.ts"

export default class AudibleImportBook extends Book {
	importStatus: "available" | "skipped" | "queued" | "downloading" | "complete" | "failed" | "cancelled"
	seriesOptions: BookSeries[]
	percentage: number | undefined
	reviewed: boolean
	padding: number

	constructor(json?: Partial<AudibleImportBook>) {
		super(json)
		this.importStatus = json?.importStatus ?? "available"
		this.seriesOptions = json?.seriesOptions?.map(series => ({ ...series })) ?? []
		this.percentage = json?.percentage
		this.reviewed = json?.reviewed ?? false
		this.padding = json?.padding ?? 2
		this.id ||= this.asin
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
