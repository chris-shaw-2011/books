import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import test from "node:test"
import { ffmpegPath } from "ffmpeg-ffprobe-static"
import { File, Mpeg4AppleTag, ReadStyle, TagTypes } from "node-taglib-sharp"
import { Book, Directory, seriesBookTitle, suggestSeriesOrganization, type SeriesOrganization } from "@books/shared"
import { createAudibleImporter, parseLibrary, type AudibleProcess } from "../../src/audible/ImportService.ts"
import { readAudioMetadata, writeAudioMetadata } from "../../src/AudioMetadata.ts"
import { seriesDestination } from "../../src/SeriesOrganization.ts"

void test("series suggestions reuse folders and padding, support prequels and novellas, and refuse ambiguous folders", () => {
	const root = new Directory({ items: [new Directory({ name: "Stormlight Series", folderPath: "/Stormlight Series", items: [new Book({ name: "01 - First" })] })] })
	const suggestion = suggestSeriesOrganization({ name: "Stormlight", order: 2.5 }, root)
	assert.deepEqual(suggestion, { folderPath: "/Stormlight Series", series: { name: "Stormlight", order: 2.5 }, padding: 2 })
	assert.ok(suggestion)
	assert.equal(seriesBookTitle("02 - Novella", suggestion.series.order, suggestion.padding), "02.5 - Novella")
	assert.equal(seriesBookTitle("Prequel", 0, suggestion.padding), "00 - Prequel")
	assert.equal(seriesBookTitle("Small decimal", 0.0000001), "00.0000001 - Small decimal")
	root.items.push(new Directory({ name: "Stormlight", folderPath: "/Other" }))
	assert.equal(suggestSeriesOrganization({ name: "Stormlight", order: 1 }, root), undefined)
	const unpadded = new Directory({ items: [new Directory({ name: "Witcher", folderPath: "/Witcher", items: [new Book({ name: "1 - First" }), new Book({ name: "10 - Tenth" })] })] })
	assert.equal(suggestSeriesOrganization({ name: "Witcher", order: 2 }, unpadded)?.padding, 1)
	const uploads = new Directory({ items: [new Directory({ name: "Upload", folderPath: "/Upload", items: [new Book({ name: "First", series: "New Series", seriesOrder: 1 })] })] })
	assert.equal(suggestSeriesOrganization({ name: "New Series", order: 2 }, uploads)?.folderPath, "/New Series")
	const prequel = new Directory({ items: [new Directory({ name: "Custom folder", folderPath: "/Custom folder", items: [new Book({ name: "00 - Prequel", series: "Series", seriesOrder: 0 })] })] })
	assert.equal(suggestSeriesOrganization({ name: "Series", order: 1 }, prequel)?.folderPath, "/Custom folder")
})

void test("parses Libation series order without treating a title or publication date as a series", () => {
	const result = parseLibrary([
		{ AudibleProductId: "ONE", Title: "First", SeriesOrder: "2.5 : Stormlight, 7 : Cosmere", SeriesNames: "Stormlight, Cosmere" },
		{ AudibleProductId: "TWO", Title: "Book 2", DatePublished: "2020-01-01", SeriesOrder: "" },
		{ AudibleProductId: "THREE", Title: "Box set", SeriesOrder: "1-3 : A series, with a comma" },
		{ AudibleProductId: "FOUR", Title: "Prequel", SeriesOrder: "0 : Prequel series" },
		{ AudibleProductId: "FIVE", Title: "Unknown", SeriesOrder: " : Unknown series" },
	])
	assert.deepEqual(result[0]?.series, [{ name: "Stormlight", order: 2.5 }, { name: "Cosmere", order: 7 }])
	assert.equal(result[1]?.series, undefined)
	assert.deepEqual(result[2]?.series, [{ name: "A series, with a comma", order: undefined }])
	assert.deepEqual(result[3]?.series, [{ name: "Prequel series", order: 0 }])
	assert.deepEqual(result[4]?.series, [{ name: "Unknown series", order: undefined }])
})

void test("series destinations reject traversal and symlinks outside the library", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "books-series-path-"))
	try {
		const library = path.join(root, "library")
		await fs.mkdir(library)
		const valid = { folderPath: "/Series", series: { name: "Series", order: 2.5 }, padding: 2 }
		for (const folderPath of ["../outside", "/../outside", "/nested/../../outside", "/bad\\folder", "/bad:name"]) await assert.rejects(seriesDestination(library, folderPath))
		await fs.symlink(root, path.join(library, "escape"))
		await assert.rejects(seriesDestination(library, "/escape/new"), /outside/)
		assert.equal(await seriesDestination(library, valid.folderPath), path.join(library, "Series"))
	}
	finally { await fs.rm(root, { recursive: true, force: true }) }
})

void test("reviewed Audible series imports publish numbered books with persistent custom order; standalone stays in Upload", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "books-series-import-"))
	const baseBooksPath = path.join(root, "library")
	const uploadLocation = path.join(baseBooksPath, "Upload")
	const indexed: Book[] = []
	assert.ok(ffmpegPath)
	await promisify(execFile)(ffmpegPath, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", "-c:a", "aac", "-metadata", "title=Original", path.join(root, "fixture.m4b")])
	await fs.mkdir(uploadLocation, { recursive: true })
	const importer = createAudibleImporter(() => ({ baseBooksPath, uploadLocation }), file => {
		const metadata = readAudioMetadata(file)
		const book = new Book({ id: path.relative(baseBooksPath, file), name: metadata.title, ...metadata })
		indexed.push(book)
		return Promise.resolve(book)
	}, () => Promise.resolve(false), {
		temporaryRoot: path.join(root, "sessions"),
		spawn: (args, directory) => {
			let exit: (code: number) => void = () => undefined
			const child: AudibleProcess = {
				write: () => setImmediate(() => exit(0)),
				kill: () => exit(1),
				onData: callback => { if (args[0] === "login-external") setImmediate(() => callback("https://www.amazon.com/ap/signin?mock=test\r\n")) },
				onExit: callback => { exit = callback },
			}
			if (args[0] !== "login-external") setImmediate(() => {
				void (async () => {
					if (args[0] === "export") await fs.writeFile(args[2] ?? "", JSON.stringify([
						{ AudibleProductId: "SERIES1", Title: "Prequel", SeriesOrder: "5 : A Series" },
						{ AudibleProductId: "SOLO1", Title: "Standalone" },
					]))
					if (args[0] === "liberate") await fs.copyFile(path.join(root, "fixture.m4b"), path.join(directory, "audio", "download.m4b"))
					exit(0)
				})().catch(() => exit(1))
			})
			return Promise.resolve(child)
		},
	})
	const waitFor = async (condition: () => boolean) => {
		for (let attempt = 0; attempt < 500; attempt++) {
			if (condition()) return
			await new Promise(resolve => setTimeout(resolve, 10))
		}
		assert.fail("Timed out waiting for series import")
	}
	try {
		const started = await importer.start("owner", "reader@example.com", "us")
		assert.ok(started)
		await waitFor(() => Boolean(importer.snapshot("owner")?.loginUrl))
		importer.redirect("owner", started.id, "https://www.audible.com/ap/maplanding?openid.oa2.authorization_code=mock")
		await waitFor(() => importer.snapshot("owner")?.phase === "selecting")
		const organization: SeriesOrganization = { series: { name: "A Series", order: 0 }, folderPath: "/Custom series", padding: 2 }
		assert.throws(() => importer.select("owner", started.id, ["SERIES1"], { SERIES1: { ...organization, series: { name: "Wrong", order: 5 } } }))
		importer.select("owner", started.id, ["SERIES1", "SOLO1"], { SERIES1: organization })
		await waitFor(() => importer.snapshot("owner")?.phase === "complete")
		assert.equal(importer.snapshot("owner")?.failed, 0)
		assert.deepEqual(indexed.map(book => book.id), ["Custom series/00 - Prequel.m4b", "Upload/Standalone.m4b"])
		const target = path.join(baseBooksPath, "Custom series", "00 - Prequel.m4b")
		const metadata = readAudioMetadata(target)
		assert.equal(metadata.series, "A Series")
		assert.equal(metadata.seriesOrder, 0)
		assert.equal(metadata.title, "00 - Prequel")
		assert.equal(metadata.asin, "SERIES1")
		assert.equal(new Book(JSON.parse(JSON.stringify(indexed[0])) as Book).seriesOrder, 0)
		writeAudioMetadata(target, { ...metadata, seriesOrder: 2.5, title: "02.5 - Prequel" })
		assert.equal(readAudioMetadata(target).seriesOrder, 2.5)
		assert.equal(readAudioMetadata(target).asin, "SERIES1")
	}
	finally {
		await importer.shutdown()
		await fs.rm(root, { recursive: true, force: true })
	}
})

void test("edits and clears the existing series tags in M4B and MP3", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "books-series-tags-"))
	try {
		assert.ok(ffmpegPath)
		for (const extension of ["m4b", "mp3"]) {
			const target = path.join(root, `Book.${extension}`)
			await promisify(execFile)(ffmpegPath, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", target])
			if (extension === "m4b") {
				const file = File.createFromPath(target, undefined, ReadStyle.None)
				try {
					const tag = file.getTag(TagTypes.Apple, true)
					assert.ok(tag instanceof Mpeg4AppleTag)
					tag.setItunesStrings("com.pilabor.tone", "SERIES", "Native series")
					tag.setItunesStrings("com.pilabor.tone", "PART", "3")
					file.save()
				}
				finally { file.dispose() }
				assert.equal(readAudioMetadata(target).series, "Native series")
				assert.equal(readAudioMetadata(target).seriesOrder, 3)
			}
			writeAudioMetadata(target, { ...readAudioMetadata(target), series: "Chosen series", seriesOrder: 1 })
			assert.equal(readAudioMetadata(target).series, "Chosen series")
			assert.equal(readAudioMetadata(target).seriesOrder, 1)
			writeAudioMetadata(target, { ...readAudioMetadata(target), seriesOrder: 0 })
			assert.equal(readAudioMetadata(target).seriesOrder, 0)
			writeAudioMetadata(target, { ...readAudioMetadata(target), series: "", seriesOrder: undefined })
			assert.equal(readAudioMetadata(target).series, "")
			assert.equal(readAudioMetadata(target).seriesOrder, undefined)
		}
	}
	finally { await fs.rm(root, { recursive: true, force: true }) }
})
