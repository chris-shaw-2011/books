/* eslint-disable @typescript-eslint/require-await -- Async process mocks. */
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import Fastify from "fastify"
import { AudibleImportResponse, Book, User } from "@books/shared"
import ServerToken from "../../src/ServerToken.ts"
import AuthorizationExpiration from "../../src/AuthorizationExpiration.ts"
import { AudibleImportService } from "../../src/audible/ImportService.ts"
import { registerAudibleRoutes } from "../../src/audible/Routes.ts"
void test("Audible routes require authentication and isolate per-user sessions", async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "audible-routes-"))
	const service = new AudibleImportService({
		spawn: async () => {
			let exit: (code: number) => void = () => undefined
			return {
				write: () => undefined,
				kill: () => {
					exit(1)
				},
				onData: callback => {
					setImmediate(() => callback("https://www.amazon.com/ap/signin?secret=hidden\r\n"))
				},
				onExit: callback => {
					exit = callback
				},
			}
		},
		validate: async () => undefined,
		hasAsin: async () => false,
		publish: async () => new Book(),
	}, path.join(root, "sessions"))
	const server = Fastify({ ajv: { customOptions: { coerceTypes: false } } })
	server.decorateRequest("userToken", undefined)
	server.addHook("onRequest", async request => {
		const owner = request.headers["x-test-user"]
		if (typeof owner === "string") {
			request.userToken = new ServerToken({
				user: new User({
					id: owner,
					email: `${owner}@example.com`,
					isAdmin: owner === "admin",
				}),
				authorization: owner,
			}, "test")
			AuthorizationExpiration.set(owner, Date.now() + 60000)
		}
	})
	registerAudibleRoutes(server, service)
	try {
		for (const route of ["/audible/status", "/audible/events"]) assert.equal((await server.inject({
			url: route,
		})).statusCode, 401)
		for (const route of ["/audible/start", "/audible/redirect", "/audible/review", "/audible/cancel", "/audible/select"]) assert.equal((await server.inject({
			method: "POST",
			url: route,
			payload: {},
		})).statusCode, 401)
		const start = await server.inject({
			method: "POST",
			url: "/audible/start",
			headers: {
				"x-test-user": "owner",
			},
			payload: {
				account: "account@example.com",
				marketplace: "us",
			},
		})
		assert.equal(start.statusCode, 200)
		const started = start.json<AudibleImportResponse>()
		assert.equal(started.type, "AudibleImportResponse")
		const snapshot = started.snapshot
		assert.ok(snapshot)
		const forbiddenOrganization = await server.inject({
			method: "POST",
			url: "/audible/select",
			headers: { "x-test-user": "owner" },
			payload: { sessionId: snapshot.id, asins: ["EXAMPLE"], organizations: { EXAMPLE: { series: { name: "Series", order: 1 }, folderPath: "/Series", padding: 2 } } },
		})
		assert.equal(forbiddenOrganization.statusCode, 403)
		const selection = { sessionId: snapshot.id, asins: ["EXAMPLE"] }
		const organization = { series: { name: "Series", order: 0 }, folderPath: "/Series", padding: 2 }
		const invalidBodies = [
			{},
			{ ...selection, asins: [] },
			{ ...selection, asins: ["EXAMPLE", "EXAMPLE"] },
			{ ...selection, asins: [12] },
			{ ...selection, organizations: [] },
			{ ...selection, organizations: { EXAMPLE: { ...organization, padding: 0 } } },
			...[-1, null, "2.5", "1-3", "NaN", undefined].map(order => ({ ...selection, organizations: { EXAMPLE: { ...organization, series: { name: "Series", order } } } })),
		]
		for (const payload of invalidBodies) {
			const rejected = await server.inject({ method: "POST", url: "/audible/select", headers: { "x-test-user": "admin" }, payload })
			assert.equal(rejected.statusCode, 400)
			assert.equal(rejected.json<AudibleImportResponse>().type, "AudibleImportResponse")
			assert.match(rejected.json<AudibleImportResponse>().errorMessage ?? "", /^body/)
		}
		for (const order of [0, 2.5]) {
			const accepted = await server.inject({ method: "POST", url: "/audible/select", headers: { "x-test-user": "admin" }, payload: { ...selection, organizations: { EXAMPLE: { ...organization, series: { name: "Series", order } } } } })
			// The schema accepted the number; session ownership remains authoritative.
			assert.equal(accepted.json<AudibleImportResponse>().errorMessage, "Import session not found")
		}
		const otherStatus = (await server.inject({
			url: "/audible/status",
			headers: {
				"x-test-user": "other",
			},
		})).json<AudibleImportResponse>()
		assert.equal(otherStatus.type, "AudibleImportResponse")
		assert.equal(otherStatus.snapshot, undefined)
		assert.equal("snapshot" in otherStatus, false)
		for (const route of ["/audible/cancel", "/audible/review"]) {
			const failed: Awaited<ReturnType<typeof server.inject>> = await server.inject({
				method: "POST",
				url: route,
				headers: {
					"x-test-user": "other",
				},
				payload: {
					sessionId: snapshot.id,
					asin: "B000000001",
				},
			})
			assert.equal(failed.statusCode, 404)
			assert.equal(failed.json<AudibleImportResponse>().type, "AudibleImportResponse")
			assert.equal(failed.json<AudibleImportResponse>().errorMessage, "Import session not found")
		}
		assert.equal((await server.inject({
			method: "POST",
			url: "/audible/redirect",
			headers: {
				"x-test-user": "other",
			},
			payload: {
				sessionId: snapshot.id,
				redirectUrl: "https://www.amazon.com/ap/maplanding?openid.oa2.authorization_code=secret",
			},
		})).statusCode, 400)
		const otherSelection = await server.inject({ method: "POST", url: "/audible/select", headers: { "x-test-user": "other" }, payload: { sessionId: snapshot.id, asins: ["B000000001"] } })
		assert.equal(otherSelection.statusCode, 400)
		assert.equal(otherSelection.json<AudibleImportResponse>().errorMessage, "Import session not found")
		const cancelled = await server.inject({
			method: "POST",
			url: "/audible/cancel",
			headers: {
				"x-test-user": "owner",
			},
			payload: {
				sessionId: snapshot.id,
			},
		})
		assert.equal(cancelled.json<AudibleImportResponse>().snapshot?.phase, "cancelled")
		assert.equal((await server.inject({
			url: "/audible/status",
			headers: {
				"x-test-user": "owner",
			},
		})).json<AudibleImportResponse>().snapshot?.phase, "cancelled")
	}
	finally {
		await server.close()
		AuthorizationExpiration.delete("admin")
		AuthorizationExpiration.delete("owner")
		AuthorizationExpiration.delete("other")
		await fs.rm(root, {
			recursive: true,
			force: true,
		})
	}
})
