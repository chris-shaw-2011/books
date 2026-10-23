/* eslint-disable @typescript-eslint/require-await -- Mock process adapter has an async spawn signature. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { Book } from "@books/shared"
import { AudibleImportService, type AudibleProcess } from "../../src/audible/ImportService.ts"

const loginUrl = "https://www.amazon.com/ap/signin?state=test"
const redirectUrl = "https://www.amazon.com/ap/maplanding?openid.oa2.authorization_code=test"

void test("falls back through high-quality AAC sources when preferred downloads fail", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-fallback-"))
	const attempts: string[][] = []
	const service = new AudibleImportService({
		spawn: async (args, directory): Promise<AudibleProcess> => {
			let onData: (data: string) => void = () => undefined
			let onExit: (code: number) => void = () => undefined
			return {
				write: () => setImmediate(() => onExit(0)),
				kill: () => onExit(1),
				onData: callback => { onData = callback },
				onExit: callback => {
					onExit = callback
					setImmediate(() => {
						void (async () => {
							if (args[0] === "login-external") {
								onData(`${loginUrl}\r\n`)
								return
							}
							if (args[0] === "export" && args[2]) await fs.writeFile(args[2], JSON.stringify([{ AudibleProductId: "B000000001", Title: "Fallback" }]))
							if (args[0] === "liberate") {
								attempts.push(args)
								if (attempts.length < 3) {
									onExit(1)
									return
								}
								await fs.writeFile(path.join(directory, "audio", "Fallback.m4b"), "fixture")
							}
							onExit(0)
						})()
					})
				},
			}
		},
		validate: async () => undefined,
		hasAsin: async () => false,
		publish: async () => new Book({ name: "Fallback" }),
	}, path.join(root, "sessions"))
	try {
		const started = await service.start("reader", "reader@example.com", "us")
		assert.ok(started)
		for (let i = 0; i < 100 && !service.snapshot("reader")?.loginUrl; i++) await new Promise(resolve => setTimeout(resolve, 5))
		service.redirect("reader", started.id, redirectUrl)
		for (let i = 0; i < 100 && service.snapshot("reader")?.phase !== "complete"; i++) await new Promise(resolve => setTimeout(resolve, 5))
		assert.equal(service.snapshot("reader")?.downloaded, 1)
		assert.equal(attempts.length, 3)
		assert.ok(attempts[0]?.includes("Request_xHE_AAC=true"))
		assert.ok(attempts[1]?.includes("Request_xHE_AAC=false"))
		assert.ok(attempts[1]?.includes("UseWidevine=true"))
		assert.ok(attempts[2]?.includes("UseWidevine=false"))
		assert.ok(attempts.every(args => args.includes("FileDownloadQuality=High")))
	}
	finally {
		await service.shutdown()
		await fs.rm(root, { recursive: true, force: true })
	}
})
