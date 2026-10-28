import type AudibleImportDirectory from "./AudibleImportDirectory.ts"
import type AudibleImportBook from "./AudibleImportBook.ts"

export type AudibleImportPhase = "authenticating" | "scanning" | "selecting" | "downloading" | "complete" | "cancelled" | "failed"

export type AudibleImportItem = AudibleImportBook | AudibleImportDirectory

export function audibleBooks(items: readonly AudibleImportItem[]): AudibleImportBook[] {
	return items.flatMap(item => item.type === "Directory" ? audibleBooks(item.items) : [item])
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
	books: AudibleImportItem[],
	activity: string[],
	error?: string,
	// Returned only by authenticated JSON requests, never in the SSE stream.
	loginUrl?: string,
}
