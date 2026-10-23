import type Book from "./Book.ts"

export type AudibleImportPhase = "authenticating" | "scanning" | "downloading" | "complete" | "cancelled" | "failed"

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
	reviewQueue: Book[],
	activity: string[],
	error?: string,
	// Returned only by authenticated JSON requests, never in the SSE stream.
	loginUrl?: string,
}
