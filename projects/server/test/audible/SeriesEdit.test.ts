import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import test from "node:test"
import { ffmpegPath } from "ffmpeg-ffprobe-static"
import { Book, BookStatuses, User, type UpdateBookResponse } from "@books/shared"
import { writeAudioMetadata, readAudioMetadata } from "../../src/AudioMetadata.ts"
import { writeAsin } from "../../src/audible/Files.ts"

void test("editing series moves a book into its new folder and preserves ASIN, timestamps and reading status", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "books-series-edit-"))
	process.env.BOOKS_DB_LOCATION = path.join(root, "books.sqlite")
	const previousPolling = process.env.CHOKIDAR_USEPOLLING
	process.env.CHOKIDAR_USEPOLLING = "true"
	const { default: db } = await import("../../src/Database.ts")
	const { default: bookList } = await import("../../src/BookList.ts")
	const { default: ServerToken } = await import("../../src/ServerToken.ts")
	const { default: AuthorizationExpiration } = await import("../../src/AuthorizationExpiration.ts")
	const { default: server } = await import("../../src/server.ts")
	db.open()
	db.settings.baseBooksPath = path.join(root, "library")
	db.settings.uploadLocation = path.join(db.settings.baseBooksPath, "Upload")
	db.settings.inviteEmail = "configured@example.com"
	db.settings.inviteEmailPassword = "unused"
	await fs.mkdir(db.settings.uploadLocation, { recursive: true })
	const original = path.join(db.settings.uploadLocation, "First.m4b")
	const timestamp = new Date("2020-01-01T00:00:00Z")
	const authorization = "series-editor-test"
	try {
		assert.ok(ffmpegPath)
		await promisify(execFile)(ffmpegPath, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", "-metadata", "title=First", original])
		writeAsin(original, "SERIESEDIT")
		writeAudioMetadata(original, { ...readAudioMetadata(original), series: "Series", seriesOrder: 5 })
		await fs.utimes(original, timestamp, timestamp)
		await bookList.loadBooks()
		const existing = bookList.findBookByPath(original)
		assert.ok(existing instanceof Book)
		const userId = db.createBootstrapAdmin("admin@example.com", "unused")
		assert.ok(userId)
		db.updateStatusesForUser(userId, new BookStatuses({ [existing.id]: { status: "Read", dateStatusSet: timestamp } }))
		const token = await ServerToken.create(new User({ id: userId, email: "admin@example.com", isAdmin: true }), authorization, db.settings.checksumSecret)
		AuthorizationExpiration.set(authorization, Date.now() + 60000)
		const updated = new Book(existing)
		Object.assign(updated, { name: "02.5 - First", folderPath: "/Custom series", seriesOrder: 2.5 })
		const invalidEdits = [
			...[-1, null, "2.5", "1-3"].map(seriesOrder => ({ seriesOrder })),
			{ series: 12 }, { author: [] }, { year: 2020.5 }, { year: "2020" }, { id: "" },
		]
		for (const changes of invalidEdits) {
			const rejected: Awaited<ReturnType<typeof server.inject>> = await server.inject({
				method: "POST", url: "/updateBook",
				headers: { cookie: `loginCookie=${encodeURIComponent(JSON.stringify(token))}` },
				payload: { newBook: { ...updated.toJSON(), ...changes } },
			})
			assert.equal(rejected.statusCode, 400)
			assert.equal(rejected.json<UpdateBookResponse>().type, "UpdateBookResponse")
			assert.match(rejected.json<UpdateBookResponse>().message, /^body/)
			await fs.access(original)
		}
		const response = await server.inject({
			method: "POST", url: "/updateBook",
			headers: { cookie: `loginCookie=${encodeURIComponent(JSON.stringify(token))}` },
			payload: { newBook: updated },
		})
		assert.equal(response.statusCode, 200)
		assert.equal(response.json<UpdateBookResponse>().message, "")
		const target = path.join(db.settings.baseBooksPath, "Custom series", "02.5 - First.m4b")
		assert.equal((await fs.stat(target)).mtimeMs, timestamp.getTime())
		assert.equal(bookList.findBookByPath(target)?.uploadTime.getTime(), timestamp.getTime())
		assert.equal(readAudioMetadata(target).seriesOrder, 2.5)
		assert.equal(readAudioMetadata(target).asin, "SERIESEDIT")
		assert.equal(db.statusesForUser(userId).get("Custom series/02.5 - First.m4b")?.status, "Read")
		await assert.rejects(fs.access(original))
	}
	finally {
		await server.stop()
		await bookList.shutdown()
		AuthorizationExpiration.delete(authorization)
		db.close()
		delete process.env.BOOKS_DB_LOCATION
		if (previousPolling === undefined) delete process.env.CHOKIDAR_USEPOLLING
		else process.env.CHOKIDAR_USEPOLLING = previousPolling
		await fs.rm(root, { recursive: true, force: true })
	}
})
