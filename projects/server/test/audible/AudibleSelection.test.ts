/* eslint-disable @typescript-eslint/require-await -- Mock async dependency signatures. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { audibleBooks, Book } from "@books/shared"
import { AudibleImportService, parseLibrary } from "../../src/audible/ImportService.ts"

const waitFor = async (condition: () => boolean) => {
	for (let attempt = 0; attempt < 200; attempt++) {
		if (condition()) return
		await new Promise(resolve => setTimeout(resolve, 5))
	}
	throw new Error("Timed out waiting for selection state")
}

const setup = async (selectionTimeoutMs = 30 * 60_000, allExisting = false) => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-selection-"))
	const commands: string[][] = []
	let directory = ""
	const existing = new Set<string>(allExisting ? ["ASIN1", "ASIN2", "ASIN3"] : [])
	const service = new AudibleImportService({
		spawn: async (args, dir) => {
			directory = dir
			commands.push(args)
			let exit: (code: number) => void = () => undefined
			return {
				write: () => setImmediate(() => exit(0)),
				kill: () => exit(1),
				onData: (callback: (data: string) => void) => {
					if (args[0] === "login-external") setImmediate(() => callback("https://www.amazon.com/ap/signin?state=private\r\n"))
				},
				onExit: (callback: (code: number) => void) => {
					exit = callback
					if (args[0] !== "login-external") setImmediate(() => {
						void (async () => {
							if (args[0] === "export" && args[2]) await fs.writeFile(args[2], JSON.stringify([1, 2, 3].map(number => ({ AudibleProductId: `ASIN${number}`, Title: `Title ${number}`, PictureUrl: `https://images.example/${number}.jpg` }))))
							if (args[0] === "liberate") await fs.writeFile(path.join(dir, "audio", "book.m4b"), "fixture")
							exit(0)
						})().catch(() => exit(1))
					})
				},
			}
		},
		hasAsin: async asin => existing.has(asin),
		validate: async () => undefined,
		publish: async (_file, title) => new Book({ id: title.asin, asin: title.asin, name: title.name }),
	}, path.join(root, "sessions"), selectionTimeoutMs)
	const started = await service.start("reader", "reader@example.com", "us")
	assert.ok(started)
	await waitFor(() => Boolean(service.snapshot("reader")?.loginUrl))
	service.redirect("reader", started.id, "https://www.audible.com/ap/maplanding?openid.oa2.authorization_code=private")
	await waitFor(() => ["selecting", "complete"].includes(service.snapshot("reader")?.phase ?? ""))
	return { service, started, commands, existing, directory, cleanup: async () => {
		await service.shutdown()
		await fs.rm(root, { recursive: true, force: true })
	} }
}

void test("only selected ASINs download, late duplicates skip, reconnect retains rows, and retries are safe", async () => {
	const fixture = await setup()
	const { service, started, commands, existing } = fixture
	try {
		assert.equal(commands.some(args => args[0] === "liberate"), false)
		await fs.access(fixture.directory)
		assert.equal(audibleBooks(service.snapshot("reader")?.books ?? [])[0]?.cover, "https://images.example/1.jpg")
		existing.add("ASIN2")
		service.select("reader", started.id, ["ASIN1", "ASIN2"])
		await waitFor(() => service.snapshot("reader")?.phase === "complete")
		service.select("reader", started.id, ["ASIN2", "ASIN1"])
		assert.deepEqual(commands.filter(args => args[0] === "liberate").map(args => args[1]), ["ASIN1"])
		const snapshot = service.snapshot("reader")
		assert.equal(snapshot?.downloaded, 1)
		assert.equal(snapshot.skipped, 1)
		assert.deepEqual(audibleBooks(snapshot.books).map(book => book.importStatus), ["complete", "skipped", "available"])
		let reconnected = false
		service.subscribe("reader", recovered => {
			reconnected = true
			assert.deepEqual(audibleBooks(recovered.books), audibleBooks(snapshot.books))
		})()
		assert.equal(reconnected, true)
		await assert.rejects(fs.access(fixture.directory))
	}
	finally { await fixture.cleanup() }
})

for (const action of ["cancel", "shutdown", "expiry"]) {
	void test(`${action} while choosing books removes credentials without downloads`, async () => {
		const fixture = await setup(action === "expiry" ? 80 : undefined)
		try {
			if (action === "cancel") await fixture.service.cancel("reader", fixture.started.id)
			else if (action === "shutdown") await fixture.service.shutdown()
			else {
				await waitFor(() => fixture.service.snapshot("reader")?.phase === "failed")
				assert.match(fixture.service.snapshot("reader")?.error ?? "", /selection expired/)
			}
			assert.equal(fixture.commands.some(args => args[0] === "liberate"), false)
			assert.equal(fixture.service.snapshot("reader")?.phase, action === "expiry" ? "failed" : "cancelled")
			await assert.rejects(fs.access(fixture.directory))
		}
		finally { await fixture.cleanup() }
	})
}

void test("optional cover URLs accept HTTPS images and discard malformed or unsafe sources", () => {
	const books = parseLibrary([{ Book: { Asin: "A", Title: "Nested", PictureUrl: "https://images.example/a.jpg" } }, { Asin: "B", Title: "Unsafe", CoverUrl: "javascript:alert(1)" }, { Asin: "C", Title: "Credentials", CoverUrl: "https://secret@images.example/c.jpg" }, { Asin: "D", Title: "Missing" }])
	assert.equal(books[0]?.cover, "https://images.example/a.jpg")
	assert.ok(books.slice(1).every(book => book.cover === ""))
})

void test("a library with no available titles completes and removes credentials immediately", async () => {
	const fixture = await setup(undefined, true)
	try {
		assert.equal(fixture.service.snapshot("reader")?.phase, "complete")
		assert.equal(fixture.service.snapshot("reader")?.skipped, 3)
		assert.equal(fixture.commands.some(args => args[0] === "liberate"), false)
		await assert.rejects(fs.access(fixture.directory))
	}
	finally { await fixture.cleanup() }
})

void test("Libation export picture identifiers become thumbnail URLs", () => {
	const books = parseLibrary([{ AudibleProductId: "A", Title: "Picture", PictureId: "51Test+Id" }, { AudibleProductId: "B", Title: "Large", PictureLarge: "51Large" }, { AudibleProductId: "C", Title: "Unsafe", PictureId: "../../secret" }])
	assert.equal(books[0]?.cover, "https://images-na.ssl-images-amazon.com/images/I/51Test%2BId._SL300_.jpg")
	assert.equal(books[1]?.cover, "https://images-na.ssl-images-amazon.com/images/I/51Large._SL300_.jpg")
	assert.equal(books[2]?.cover, "")
})

void test("selection exports fill the shared book metadata used by the normal list", () => {
	const [book] = parseLibrary([{ AudibleProductId: "META", Title: "A Book", AuthorNames: "Author One, Author Two", NarratorNames: "A Narrator", Description: "A complete description.", CategoriesNames: "Fantasy; Adventure", LengthInMinutes: 123, DatePublished: "2021-09-10T00:00:00Z" }])
	assert.ok(book)
	assert.equal(book.author, "Author One, Author Two")
	assert.equal(book.narrator, "A Narrator")
	assert.equal(book.comment, "A complete description.")
	assert.equal(book.genre, "Fantasy; Adventure")
	assert.equal(book.duration, 7380)
	assert.equal(book.year, 2021)
	const [missing] = parseLibrary([{ AudibleProductId: "MISSING", Title: "Missing", DatePublished: "unknown", AuthorNames: [], LengthInMinutes: -1 }])
	assert.equal(missing?.year, 0)
	assert.equal(missing.duration, 0)
	assert.equal(missing.author, "")
})
