import assert from "node:assert/strict"
import { test } from "node:test"
import { audibleBooks, AudibleImportBook, AudibleImportDirectory, AudibleImportResponse, Book, Directory, Unauthorized, type AudibleImportSnapshot } from "@books/shared"
import LoggedInApi from "../src/app/api/LoggedInApi.ts"
import { itemOrders, orderItems } from "../src/app/ItemOrder.ts"
import { filterImportedBooks } from "../src/app/AudibleImportItems.ts"

void test("hiding imported books prunes empty ancestors and preserves mixed import folders", () => {
	const imported = new AudibleImportBook({ asin: "OLD", importStatus: "skipped", uploadTime: new Date(100) })
	const available = new AudibleImportBook({ asin: "NEW", importStatus: "available", uploadTime: new Date(900) })
	const importedOnly = new AudibleImportDirectory({ items: [new AudibleImportDirectory({ items: [imported] })] })
	const mixed = new AudibleImportDirectory({ id: "series", name: "Series", folderPath: "/Series", hasBooks: true, items: [imported, available, importedOnly] })
	const items = [imported, importedOnly, new AudibleImportDirectory({ items: [mixed] })]
	const originalAvailable = audibleBooks(items).find(book => book.asin === "NEW")
	const before = JSON.stringify(items)
	const filtered = filterImportedBooks(items)

	assert.equal(filtered.length, 1)
	const parent = filtered[0]
	assert.ok(parent instanceof AudibleImportDirectory)
	const folder = parent.items[0]
	assert.ok(folder instanceof AudibleImportDirectory)
	assert.notEqual(folder, mixed)
	assert.equal(folder.id, "series")
	assert.equal(folder.name, "Series")
	assert.equal(folder.folderPath, "/Series")
	assert.equal(folder.hasBooks, true)
	assert.deepEqual(folder.items, [originalAvailable])
	assert.equal(folder.items[0], originalAvailable)
	assert.equal(folder.minUploadTime?.getTime(), 900)
	assert.equal(JSON.stringify(items), before)
	assert.deepEqual(filterImportedBooks([importedOnly, imported]), [])
	assert.deepEqual(filterImportedBooks([]), [])
})

void test("hiding previously imported books keeps downloads, new completions and reviews visible", () => {
	const books = (["available", "queued", "downloading", "complete", "failed", "cancelled", "skipped"] as const)
		.map(importStatus => new AudibleImportBook({ asin: importStatus, importStatus }))
	const filtered = filterImportedBooks(books)
	assert.deepEqual(filtered, books.slice(0, -1))
	for (const [index, book] of filtered.entries()) assert.equal(book, books[index])
})

const onFailure = (message?: string) => assert.fail(message ?? "Unexpected API failure")

void test("selected series destinations and custom reading orders are sent for import", async () => {
	const originalFetch = globalThis.fetch
	let sent: RequestInit | undefined
	globalThis.fetch = (_input, init) => {
		sent = init
		return Promise.resolve(Response.json(new AudibleImportResponse()))
	}
	try {
		const organizations = { ONE: { series: { name: "Series", order: 0 }, folderPath: "/Series", padding: 2 } }
		await LoggedInApi.audibleSelect("session", ["ONE"], onFailure, organizations)
		assert.deepEqual(JSON.parse(sent?.body as string), { type: "AudibleSelectionRequest", sessionId: "session", asins: ["ONE"], organizations })
	}
	finally { globalThis.fetch = originalFetch }
})

const snapshot = (extra: Partial<AudibleImportSnapshot> = {}): AudibleImportSnapshot => ({
	id: "session", phase: "downloading", operation: "Downloading", currentTitle: "Book one",
	total: 3, skipped: 0, downloaded: 1, failed: 0, remaining: 2,
	books: [new AudibleImportBook({ id: "one", name: "Book one", asin: "ASIN1", importStatus: "complete" })], activity: [], ...extra,
})

void test("Audible responses restore books in progress snapshots", () => {
	const first = AudibleImportResponse.restoreSnapshot(JSON.parse(JSON.stringify(snapshot())) as AudibleImportSnapshot)
	const next = AudibleImportResponse.restoreSnapshot(snapshot({ downloaded: 2, remaining: 1, books: [...audibleBooks(first.books), new AudibleImportBook({ id: "two", asin: "ASIN2", importStatus: "complete" })] }))

	assert.ok(audibleBooks(first.books)[0] instanceof Book)
	assert.equal(audibleBooks(next.books).length, 2)
	assert.equal(audibleBooks(next.books)[0]?.asin, "ASIN1")
	assert.equal(next.remaining, 1)
})

void test("review requests acknowledge one book and recover the remaining server queue", async () => {
	const originalFetch = globalThis.fetch
	let sent: RequestInit | undefined

	globalThis.fetch = (_input, init) => {
		sent = init
		return Promise.resolve(Response.json(new AudibleImportResponse({ snapshot: snapshot({ books: [new AudibleImportBook({ id: "two", asin: "ASIN2", importStatus: "complete" })] }) })))
	}
	try {
		const response = await LoggedInApi.audibleReview("session", "ASIN1", onFailure)

		assert.deepEqual(JSON.parse(sent?.body as string), { type: "AudibleReviewRequest", sessionId: "session", asin: "ASIN1" })
		assert.ok(response instanceof AudibleImportResponse)
		assert.equal((response.snapshot && audibleBooks(response.snapshot.books)[0])?.asin, "ASIN2")
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
		await LoggedInApi.audibleSelect("session", ["ASIN1", "ASIN2"], onFailure)
		await LoggedInApi.audibleCancel("session", onFailure)
		await LoggedInApi.audibleReview("session", "ASIN1", onFailure)

		assert.ok(response instanceof AudibleImportResponse)
		assert.ok((response.snapshot && audibleBooks(response.snapshot.books)[0]) instanceof Book)
		assert.deepEqual(calls.map(call => [call.url, call.init?.method]), [
			["/audible/status", "GET"], ["/audible/start", "POST"], ["/audible/redirect", "POST"],
			["/audible/select", "POST"], ["/audible/cancel", "POST"], ["/audible/review", "POST"],
		])
		assert.equal(calls[0]?.init?.signal, signal)
		assert.deepEqual(calls.slice(1).map(call => JSON.parse(call.init?.body as string) as object), [
			{ type: "AudibleStartRequest", account: "reader@example.com", marketplace: "us" },
			{ type: "AudibleRedirectRequest", sessionId: "session", redirectUrl: "https://amazon.com/redirect" },
			{ type: "AudibleSelectionRequest", sessionId: "session", asins: ["ASIN1", "ASIN2"] },
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

void test("selection and per-book progress survive response restoration and reconnect snapshots", () => {
	const selecting = new AudibleImportResponse({ snapshot: snapshot({ phase: "selecting", books: [
		new AudibleImportBook({ asin: "ASIN1", name: "Book one", cover: "https://example.com/cover.jpg", importStatus: "available" }),
		new AudibleImportBook({ asin: "ASIN2", name: "Already imported", importStatus: "skipped" }),
	] }) })
	assert.equal(selecting.snapshot?.phase, "selecting")
	assert.deepEqual(audibleBooks(selecting.snapshot.books).map(book => book.importStatus), ["available", "skipped"])

	const reconnect = AudibleImportResponse.restoreSnapshot(JSON.parse(JSON.stringify(snapshot({ books: [
		new AudibleImportBook({ id: "one", asin: "ASIN1", name: "Book one", importStatus: "complete", reviewed: true }),
		new AudibleImportBook({ asin: "ASIN2", name: "Book two", importStatus: "downloading", percentage: 42 }),
		new AudibleImportBook({ asin: "ASIN3", name: "Book three", importStatus: "queued" }),
	] }))) as AudibleImportSnapshot)
	assert.ok(audibleBooks(reconnect.books)[0] instanceof AudibleImportBook)
	assert.equal(audibleBooks(reconnect.books)[0]?.reviewed, true)
	assert.equal(audibleBooks(reconnect.books)[1]?.percentage, 42)
	assert.equal(audibleBooks(reconnect.books)[2]?.importStatus, "queued")
})

void test("import books share Book metadata without aliases or nested copies", () => {
	const source = new AudibleImportBook({ asin: "ONE", name: "Prequel", series: "A Series", seriesOrder: 0, importStatus: "downloading", status: "Read", uploadTime: new Date(1234) })
	const restored = AudibleImportResponse.restoreSnapshot(JSON.parse(JSON.stringify(snapshot({ books: [source] }))) as AudibleImportSnapshot).books[0]
	assert.ok(restored instanceof AudibleImportBook)
	assert.ok(restored instanceof Book)
	assert.equal(restored.uploadTime.getTime(), 1234)
	assert.equal(restored.status, "Read")
	assert.equal(restored.importStatus, "downloading")
	assert.equal(restored.series, "A Series")
	assert.equal(restored.seriesOrder, 0)
	assert.deepEqual(restored.seriesChoices, [{ name: "A Series", order: 0 }])
	for (const duplicate of ["title", "coverUrl", "book", "organization"]) assert.equal(Object.hasOwn(restored, duplicate), false)
})

void test("sorting preserves import instances and metadata while finding moved books by ASIN", () => {
	const importBook = new AudibleImportBook({ asin: "ONE", name: "Zebra", percentage: 42, uploadTime: new Date(100) })
	const regular = new Book({ id: "moved", asin: "TWO", name: "Apple", uploadTime: new Date(200) })
	const books = [importBook, regular]
	assert.deepEqual(orderItems(books, "Alphabetically - Ascending"), [regular, importBook])
	assert.equal(orderItems(books, "Uploaded - Ascending")[0], importBook)
	assert.deepEqual(books, [importBook, regular])
	const directory = new Directory({ items: [new Directory({ items: [regular] })] })
	assert.equal(directory.findBookByAsin("TWO")?.id, "moved")
	assert.equal(directory.findBookByAsin(""), undefined)
})

void test("ordering prepares every folder before rendering without changing the library tree", () => {
	const oldest = new Book({ name: "Apple", uploadTime: new Date(100) })
	const newest = new AudibleImportBook({ name: "Zebra", uploadTime: new Date(900), percentage: 42 })
	const nested = new Directory({ name: "Nested" })
	nested.items = [newest, oldest]
	const folder = new Directory({ name: "Zebra folder" })
	folder.items = [nested]
	const regular = new Book({ name: "Middle", uploadTime: new Date(500) })
	const items = [folder, regular]
	for (const order of Object.keys(itemOrders) as (keyof typeof itemOrders)[]) {
		const sorted = orderItems(items, order)
		const alphabeticalAscending = order === "Alphabetically - Ascending"
		assert.deepEqual(sorted.map(item => item.name), alphabeticalAscending ? ["Middle", "Zebra folder"] : ["Zebra folder", "Middle"])
		const sortedFolder = sorted.find(item => item.type === "Directory")
		assert.ok(sortedFolder instanceof Directory)
		assert.notEqual(sortedFolder, folder)
		const sortedNested = sortedFolder.items[0]
		assert.ok(sortedNested instanceof Directory)
		const descending = order.endsWith("Descending")
		assert.equal(sortedNested.items[0], descending ? newest : oldest)
		assert.equal(sortedNested.items[1], descending ? oldest : newest)
		assert.ok(sortedNested.items.find(item => item === newest) instanceof AudibleImportBook)
		assert.equal(newest.percentage, 42)
	}
	assert.equal(folder.minUploadTime?.getTime(), 100)
	assert.equal(folder.maxUploadTime?.getTime(), 900)
	assert.equal(nested.minUploadTime?.getTime(), 100)
	assert.equal(nested.maxUploadTime?.getTime(), 900)
	assert.deepEqual(nested.items, [newest, oldest])
	assert.deepEqual(items, [folder, regular])
	assert.deepEqual(orderItems([], "Uploaded - Ascending"), [])
})
