import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { User } from "@books/shared"

void test("an authenticated non-admin cannot update book metadata through the API", async () => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "books-auth-test-"))
	process.env.BOOKS_DB_LOCATION = path.join(directory, "books.sqlite")
	const { default: db } = await import("../../src/Database.ts")
	const { default: ServerToken } = await import("../../src/ServerToken.ts")
	const { default: AuthorizationExpiration, getNewAuthorizationExpiration } = await import("../../src/AuthorizationExpiration.ts")
	const { default: server } = await import("../../src/server.ts")

	try {
		db.open()
		const user = new User({ id: randomUUID(), email: "reader@example.com", isAdmin: false })
		const authorization = randomUUID()
		const token = await ServerToken.create(user, authorization, db.settings.checksumSecret)
		AuthorizationExpiration.set(authorization, getNewAuthorizationExpiration())
		const response = await server.inject({
			method: "POST",
			url: "/updateBook",
			headers: { cookie: `loginCookie=${encodeURIComponent(JSON.stringify(token))}` },
			payload: { newBook: { id: "missing", name: "Changed" } },
		})

		assert.equal(response.statusCode, 403)
		assert.equal(response.json<{ type: string }>().type, "AccessDenied")
	}
	finally {
		await server.stop()
		db.close()
		delete process.env.BOOKS_DB_LOCATION
		await fs.rm(directory, { recursive: true, force: true })
	}
})
