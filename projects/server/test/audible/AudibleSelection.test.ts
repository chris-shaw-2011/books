/* eslint-disable @typescript-eslint/require-await -- Mock async dependency signatures. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { audibleBooks, AudibleImportBook, Book } from "@books/shared"
import { AudibleImportService, parseLibrary } from "../../src/audible/ImportService.ts"
import libationBook from "./LibationBook.ts"

const waitFor = async (condition: () => boolean) => {
	for (let attempt = 0; attempt < 200; attempt++) {
		if (condition()) {
			return
		}

		await new Promise(resolve => setTimeout(resolve, 5))
	}

	throw new Error("Timed out waiting for selection state")
}

const setup = async (selectionTimeoutMs = 30 * 60_000, allExisting = false, exportContent?: string) => {
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
					if (args[0] === "login-external") {
						setImmediate(() => callback("https://www.amazon.com/ap/signin?state=private\r\n"))
					}
				},
				onExit: (callback: (code: number) => void) => {
					exit = callback

					if (args[0] !== "login-external") {
						setImmediate(() => {
							void (async () => {
								if (args[0] === "export" && args[2]) {
									await fs.writeFile(args[2], exportContent ?? JSON.stringify([1, 2, 3].map(number => libationBook({ AudibleProductId: `ASIN${number}`, Title: `Title ${number}`, PictureId: `image${number}` }))))
								}

								if (args[0] === "liberate") {
									await fs.writeFile(path.join(dir, "audio", "book.m4b"), "fixture")
								}

								exit(0)
							})().catch(() => exit(1))
						})
					}
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
	await waitFor(() => ["selecting", "complete", "failed"].includes(service.snapshot("reader")?.phase ?? ""))

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
		assert.equal(audibleBooks(service.snapshot("reader")?.books ?? [])[0]?.cover, "https://images-na.ssl-images-amazon.com/images/I/image1._SL300_.jpg")
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
	finally {
		await fixture.cleanup()
	}
})

for (const action of ["cancel", "shutdown", "expiry"]) {
	void test(`${action} while choosing books removes credentials without downloads`, async () => {
		const fixture = await setup(action === "expiry" ? 80 : undefined)

		try {
			if (action === "cancel") {
				await fixture.service.cancel("reader", fixture.started.id)
			}
			else if (action === "shutdown") {
				await fixture.service.shutdown()
			}
			else {
				await waitFor(() => fixture.service.snapshot("reader")?.phase === "failed")
				assert.match(fixture.service.snapshot("reader")?.error ?? "", /selection expired/)
			}

			assert.equal(fixture.commands.some(args => args[0] === "liberate"), false)
			assert.equal(fixture.service.snapshot("reader")?.phase, action === "expiry" ? "failed" : "cancelled")
			await assert.rejects(fs.access(fixture.directory))
		}
		finally {
			await fixture.cleanup()
		}
	})
}

void test("unexpected export shapes fail instead of guessing formats or returning partial libraries", () => {
	const valid = libationBook()

	for (const invalid of [null, {}, { books: [valid] }, [null], [1], [{ Book: valid }], [{ Asin: "A", Title: "Alias" }], [valid, { ...valid, AudibleProductId: "" }]]) {
		assert.throws(() => parseLibrary(JSON.stringify(invalid)), /Invalid Libation library export/)
	}

	assert.deepEqual(parseLibrary(JSON.stringify([])), [])
	assert.equal(parseLibrary(JSON.stringify([valid, valid])).length, 1)
})

void test("unexpected book metadata fails instead of silently substituting defaults", () => {
	for (const invalid of [{ AuthorNames: [] }, { Title: null }, { ContentType: null }, { SeriesOrder: [] }, { DatePublished: "unknown" }, { LengthInMinutes: -1 }, { LengthInMinutes: "123" }, { PictureId: {} }]) {
		assert.throws(() => parseLibrary(JSON.stringify([{ ...libationBook(), ...invalid }])), /Invalid Libation library export/)
	}

	assert.throws(() => parseLibrary(JSON.stringify([{ ...libationBook(), AuthorNames: undefined }])), /AuthorNames/)
})

for (const [name, content] of [["invalid JSON", "{"], ["invalid schema", JSON.stringify([libationBook(), { Asin: "UNEXPECTED", Title: "Unexpected format" }])]]) {
	void test(`${name} fails the import with an investigation message and removes temporary files`, async () => {
		const fixture = await setup(undefined, false, content)

		try {
			const snapshot = fixture.service.snapshot("reader")

			assert.equal(snapshot?.phase, "failed")
			assert.match(snapshot.error ?? "", /unexpected library export.*investigation/)
			assert.deepEqual(snapshot.books, [])
			assert.equal(fixture.commands.some(args => args[0] === "liberate"), false)
			await assert.rejects(fs.access(fixture.directory))
		}
		finally {
			await fixture.cleanup()
		}
	})
}

void test("a library with no available titles completes and removes credentials immediately", async () => {
	const fixture = await setup(undefined, true)

	try {
		assert.equal(fixture.service.snapshot("reader")?.phase, "complete")
		assert.equal(fixture.service.snapshot("reader")?.skipped, 3)
		assert.equal(fixture.commands.some(args => args[0] === "liberate"), false)
		await assert.rejects(fs.access(fixture.directory))
	}
	finally {
		await fixture.cleanup()
	}
})

void test("Libation export picture identifiers become thumbnail URLs", () => {
	const books = parseLibrary(JSON.stringify([libationBook({ AudibleProductId: "A", Title: "Picture", PictureId: "51Test+Id" }), libationBook({ AudibleProductId: "B", Title: "Large", PictureLarge: "51Large" }), libationBook({ AudibleProductId: "C", Title: "Missing" })]))

	assert.equal(books[0]?.cover, "https://images-na.ssl-images-amazon.com/images/I/51Test%2BId._SL300_.jpg")
	assert.equal(books[1]?.cover, "https://images-na.ssl-images-amazon.com/images/I/51Large._SL300_.jpg")
	assert.equal(books[2]?.cover, "")
})

void test("selection exports fill the shared book metadata used by the normal list", () => {
	const book = AudibleImportBook.fromLibation(libationBook({ AudibleProductId: "META", Title: "A Book", AuthorNames: "Author One, Author Two", NarratorNames: "A Narrator", Description: "A complete description.", CategoriesNames: "Fantasy; Adventure", LengthInMinutes: 123, DatePublished: "2021-09-10T00:00:00Z" }))

	assert.ok(book instanceof AudibleImportBook)
	assert.equal(book.author, "Author One, Author Two")
	assert.equal(book.narrator, "A Narrator")
	assert.equal(book.comment, "A complete description.")
	assert.equal(book.genre, "Fantasy; Adventure")
	assert.equal(book.duration, 7380)
	assert.equal(book.year, 2021)
	const missing = AudibleImportBook.fromLibation(libationBook({ AudibleProductId: "MISSING", Title: "Missing" }))

	assert.equal(missing.year, 0)
	assert.equal(missing.duration, 0)
	assert.equal(missing.author, "")
})
