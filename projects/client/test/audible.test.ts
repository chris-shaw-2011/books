import assert from "node:assert/strict"
import { test } from "node:test"
import { AudibleImportResponse, Book, Unauthorized, type AudibleImportSnapshot } from "@books/shared"
import LoggedInApi from "../src/app/api/LoggedInApi.ts"

const onFailure = (message?: string) => assert.fail(message ?? "Unexpected API failure")

const snapshot = (extra: Partial<AudibleImportSnapshot> = {}): AudibleImportSnapshot => ({
	id: "session", phase: "downloading", operation: "Downloading", currentTitle: "Book one",
	total: 3, skipped: 0, downloaded: 1, failed: 0, remaining: 2,
	reviewQueue: [new Book({ id: "one", name: "Book one", asin: "ASIN1" })], activity: [], ...extra,
})

void test("Audible responses restore books in progress snapshots", () => {
	const first = AudibleImportResponse.restoreSnapshot(JSON.parse(JSON.stringify(snapshot())) as AudibleImportSnapshot)
	const next = AudibleImportResponse.restoreSnapshot(snapshot({ downloaded: 2, remaining: 1, reviewQueue: [...first.reviewQueue, new Book({ id: "two", asin: "ASIN2" })] }))

	assert.ok(first.reviewQueue[0] instanceof Book)
	assert.equal(next.reviewQueue.length, 2)
	assert.equal(next.reviewQueue[0]?.asin, "ASIN1")
	assert.equal(next.remaining, 1)
})

void test("review requests acknowledge one book and recover the remaining server queue", async () => {
	const originalFetch = globalThis.fetch
	let sent: RequestInit | undefined

	globalThis.fetch = (_input, init) => {
		sent = init
		return Promise.resolve(Response.json(new AudibleImportResponse({ snapshot: snapshot({ reviewQueue: [new Book({ id: "two", asin: "ASIN2" })] }) })))
	}
	try {
		const response = await LoggedInApi.audibleReview("session", "ASIN1", onFailure)

		assert.deepEqual(JSON.parse(sent?.body as string), { type: "AudibleReviewRequest", sessionId: "session", asin: "ASIN1" })
		assert.ok(response instanceof AudibleImportResponse)
		assert.equal(response.snapshot?.reviewQueue[0]?.asin, "ASIN2")
	}
	finally {
		globalThis.fetch = originalFetch
	}
})

void test("Audible API methods use the expected routes and request bodies", async () => {
	const originalFetch = globalThis.fetch
	const calls: { url: string, init: RequestInit | undefined }[] = []

	globalThis.fetch = (input, init) => {
		calls.push({ url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url, init })
		return Promise.resolve(Response.json(new AudibleImportResponse({ snapshot: snapshot() })))
	}
	try {
		const signal = new AbortController().signal
		const response = await LoggedInApi.audibleStatus(onFailure, signal)
		await LoggedInApi.audibleStart("reader@example.com", "us", onFailure)
		await LoggedInApi.audibleRedirect("session", "https://amazon.com/redirect", onFailure)
		await LoggedInApi.audibleCancel("session", onFailure)
		await LoggedInApi.audibleReview("session", "ASIN1", onFailure)

		assert.ok(response instanceof AudibleImportResponse)
		assert.ok(response.snapshot?.reviewQueue[0] instanceof Book)
		assert.deepEqual(calls.map(call => [call.url, call.init?.method]), [
			["/audible/status", "GET"], ["/audible/start", "POST"], ["/audible/redirect", "POST"],
			["/audible/cancel", "POST"], ["/audible/review", "POST"],
		])
		assert.equal(calls[0]?.init?.signal, signal)
		assert.deepEqual(calls.slice(1).map(call => JSON.parse(call.init?.body as string) as object), [
			{ type: "AudibleStartRequest", account: "reader@example.com", marketplace: "us" },
			{ type: "AudibleRedirectRequest", sessionId: "session", redirectUrl: "https://amazon.com/redirect" },
			{ type: "AudibleSessionRequest", sessionId: "session" },
			{ type: "AudibleReviewRequest", sessionId: "session", asin: "ASIN1" },
		])
	}
	finally {
		globalThis.fetch = originalFetch
	}
})

void test("Audible API forwards expired authentication to the failure callback", async () => {
	const originalFetch = globalThis.fetch
	let failures = 0

	globalThis.fetch = () => Promise.resolve(Response.json(new Unauthorized("Please sign in again."), { status: 401 }))
	try {
		const controller = new AbortController()
		const response = LoggedInApi.audibleStatus(() => {
			failures++
		}, controller.signal)
		await new Promise(resolve => setImmediate(resolve))
		assert.equal(failures, 1)
		controller.abort()
		await response
	}
	finally {
		globalThis.fetch = originalFetch
	}
})

void test("Audible API returns typed import errors", async () => {
	const originalFetch = globalThis.fetch

	globalThis.fetch = () => Promise.resolve(Response.json(new AudibleImportResponse({ errorMessage: "Import session not found" }), { status: 404 }))
	try {
		const response = await LoggedInApi.audibleCancel("missing", onFailure)
		assert.ok(response instanceof AudibleImportResponse)
		assert.equal(response.errorMessage, "Import session not found")
	}
	finally {
		globalThis.fetch = originalFetch
	}
})
