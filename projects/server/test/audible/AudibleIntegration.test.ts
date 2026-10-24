import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import Fastify from "fastify"
import { ffmpegPath } from "ffmpeg-ffprobe-static"
import { Book, User, type AudibleImportResponse, type Books } from "@books/shared"
import { createAudibleImporter, type AudibleProcess } from "../../src/audible/ImportService.ts"
import { readAsin } from "../../src/audible/Files.ts"
import { registerAudibleRoutes } from "../../src/audible/Routes.ts"
const waitFor = async (condition: () => boolean) => {
	for (let attempt = 0; attempt < 300; attempt++) {
		if (condition()) return
		await new Promise(resolve => setTimeout(resolve, 10))
	}
	throw new Error("Timed out waiting for integrated Audible import")
}
void test("Audible HTTP authentication publishes and indexes a real M4B while remaining downloads continue", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "books-audible-integration-"))
	process.env.BOOKS_DB_LOCATION = path.join(root, "books.sqlite")
	const previousPolling = process.env.CHOKIDAR_USEPOLLING
	process.env.CHOKIDAR_USEPOLLING = "true"
	const {
		default: db,
	} = await import("../../src/Database.ts")
	const {
		default: bookList,
	} = await import("../../src/BookList.ts")
	const {
		default: ServerBook,
	} = await import("../../src/ServerBook.ts")
	const {
		default: ServerToken,
	} = await import("../../src/ServerToken.ts")
	const {
		default: AuthorizationExpiration,
	} = await import("../../src/AuthorizationExpiration.ts")
	const server = Fastify()
	let libraryServer: Awaited<typeof import("../../src/server.ts")>["default"] | undefined
	let secondDownloadRunning = false
	let processDirectory = ""
	const calls: string[][] = []
	db.open()
	db.settings.baseBooksPath = path.join(root, "library")
	db.settings.uploadLocation = path.join(db.settings.baseBooksPath, "Uploads")
	db.settings.inviteEmail = "configured@example.com"
	db.settings.inviteEmailPassword = "unused-test-setting"
	await fs.mkdir(db.settings.uploadLocation, {
		recursive: true,
	})
	const importer = createAudibleImporter(() => db.settings, async file => {
		await bookList.fileAdded(file)
		const indexed = bookList.findBookByPath(file)
		assert.ok(indexed instanceof ServerBook)
		return new Book(indexed)
	}, asin => bookList.hasAsin(asin), {
		temporaryRoot: path.join(root, "sessions"),
		spawn: (args, directory) => {
			processDirectory = directory
			calls.push(args)
			let data: (value: string) => void = () => undefined
			let exit: (code: number) => void = () => undefined
			const child: AudibleProcess = {
				write: value => {
					assert.match(value, /openid\.oa2\.authorization_code=mock-code/)
					setImmediate(() => exit(0))
				},
				kill: () => {
					exit(1)
				},
				onData: callback => {
					data = callback
				},
				onExit: callback => {
					exit = callback
				},
			}
			setImmediate(() => {
				void (async () => {
					if (args[0] === "login-external") {
						data("Open this URL:\r\nhttps://www.amazon.com/ap/signin?private-login=mock\r\nPaste URL: ")
						return
					}
					if (args[0] === "export") {
						const exported = args[2]
						assert.ok(exported)
						await fs.writeFile(exported, JSON.stringify([{
							AudibleProductId: "B000000001",
							Title: "First audiobook",
							IsAudiblePlus: false,
						}, {
							AudibleProductId: "B000000002",
							Title: "Second audiobook",
							IsAudiblePlus: true,
						}]))
					}
					if (args[0] === "liberate") {
						if (args[1] === "B000000002") {
							secondDownloadRunning = true
							data("[######")
							data("......................................................]  ETA 1:00")
							return
						}
						await fs.copyFile(path.join(root, "fixture.m4b"), path.join(directory, "audio", "complete.m4b"))
						data(" 100% ")
					}
					exit(0)
				})().catch(() => exit(1))
			})
			return Promise.resolve(child)
		},
	})
	const authorization = "audible-integration-user"
	const token = await ServerToken.create(new User({
		id: "integration-user",
		email: "reader@example.com",
		isAdmin: false,
	}), authorization, db.settings.checksumSecret)
	AuthorizationExpiration.set(authorization, Date.now() + 60000)
	server.decorateRequest("userToken", undefined)
	server.addHook("onRequest", request => {
		request.userToken = token
		return Promise.resolve()
	})
	registerAudibleRoutes(server, importer)
	try {
		assert.ok(ffmpegPath)
		await promisify(execFile)(ffmpegPath, ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.3", "-c:a", "aac", "-metadata", "title=Fixture title", path.join(root, "fixture.m4b")])
		await bookList.loadBooks()
		libraryServer = (await import("../../src/server.ts")).default
		const start = await server.inject({
			method: "POST",
			url: "/audible/start",
			payload: {
				account: "reader@example.com",
				marketplace: "us",
			},
		})
		assert.equal(start.statusCode, 200)
		const started = start.json<AudibleImportResponse>().snapshot
		assert.ok(started)
		await waitFor(() => Boolean(importer.snapshot(token.user.id)?.loginUrl))
		const authenticated = await server.inject({
			method: "POST",
			url: "/audible/redirect",
			payload: {
				sessionId: started.id,
				redirectUrl: "https://www.amazon.com/ap/maplanding?openid.oa2.authorization_code=mock-code",
			},
		})
		assert.equal(authenticated.statusCode, 200)
		await waitFor(() => importer.snapshot(token.user.id)?.phase === "selecting")
		assert.equal(calls.some(args => args[0] === "liberate"), false)
		const invalidSelection = await server.inject({ method: "POST", url: "/audible/select", payload: { sessionId: started.id, asins: ["unknown"] } })
		assert.equal(invalidSelection.statusCode, 400)
		const selection = await server.inject({ method: "POST", url: "/audible/select", payload: { sessionId: started.id, asins: ["B000000001", "B000000002"] } })
		assert.equal(selection.statusCode, 200)
		await waitFor(() => secondDownloadRunning && importer.snapshot(token.user.id)?.downloaded === 1)
		const status = await server.inject({
			url: "/audible/status",
		})
		const snapshot = status.json<AudibleImportResponse>().snapshot
		assert.ok(snapshot)
		assert.equal(snapshot.phase, "downloading")
		assert.equal(snapshot.remaining, 1)
		assert.equal(snapshot.books[0]?.status, "complete")
		assert.equal(snapshot.books[1]?.status, "downloading")
		assert.equal(snapshot.books[1].percentage, 10)
		assert.equal(snapshot.reviewQueue.length, 1)
		assert.equal(snapshot.reviewQueue[0]?.asin, "B000000001")
		const library = await libraryServer.inject({
			method: "POST",
			url: "/books",
			headers: {
				cookie: `loginCookie=${encodeURIComponent(JSON.stringify(token))}`,
			},
		})
		assert.equal(library.statusCode, 200)
		const books = library.json<Books>()
		assert.equal(books.type, "Books")
		assert.ok(JSON.stringify(books.directory).includes(snapshot.reviewQueue[0].id))
		assert.ok(JSON.stringify(books.directory).includes("Fixture title"))
		const target = path.join(db.settings.uploadLocation, "First audiobook.m4b")
		assert.equal(readAsin(target), "B000000001")
		assert.equal((await bookList.allBooks()).bookCount(), 1)
		assert.equal(await bookList.hasAsin("B000000001"), true)
		assert.equal(snapshot.reviewQueue[0].asin, "B000000001")
		assert.equal(calls.filter(args => args[0] === "liberate").length, 2)
		const cancelled = await server.inject({
			method: "POST",
			url: "/audible/cancel",
			payload: {
				sessionId: started.id,
			},
		})
		assert.equal(cancelled.json<AudibleImportResponse>().snapshot?.phase, "cancelled")
		assert.equal(cancelled.json<AudibleImportResponse>().snapshot?.reviewQueue.length, 1)
		await assert.rejects(fs.access(processDirectory))
		assert.equal(readAsin(target), "B000000001")
	}
	finally {
		await server.close()
		await libraryServer?.stop()
		await bookList.shutdown()
		AuthorizationExpiration.delete(authorization)
		db.close()
		delete process.env.BOOKS_DB_LOCATION
		if (previousPolling === undefined) delete process.env.CHOKIDAR_USEPOLLING
		else process.env.CHOKIDAR_USEPOLLING = previousPolling
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
