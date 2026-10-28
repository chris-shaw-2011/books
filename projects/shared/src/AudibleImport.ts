import type Book from "./Book.ts"
import type { BookSeries, SeriesOrganization } from "./Series.ts"

export type AudibleImportPhase = "authenticating" | "scanning" | "selecting" | "downloading" | "complete" | "cancelled" | "failed"

export interface AudibleImportBook {
	asin: string,
	title: string,
	series?: BookSeries[],
	organization?: SeriesOrganization,
	coverUrl?: string,
	status: "available" | "skipped" | "queued" | "downloading" | "complete" | "failed" | "cancelled",
	percentage?: number,
	book?: Book,
	reviewed?: boolean,
}

export interface AudibleImportSnapshot {
	id: string,
	phase: AudibleImportPhase,
	operation: string,
	currentTitle: string,
	percentage?: number,
	total: number,
	skipped: number,
	downloaded: number,
	failed: number,
	remaining: number,
	books: AudibleImportBook[],
	reviewQueue: Book[],
	activity: string[],
	error?: string,
	// Returned only by authenticated JSON requests, never in the SSE stream.
	loginUrl?: string,
}
