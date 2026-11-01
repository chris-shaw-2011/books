import assert from "node:assert/strict"
import { test } from "node:test"
import { AudibleImportBook, AudibleImportDirectory, AudibleImportResponse, Book, ChangeBookStatusRequest, LoginRequest, SettingsUpdate, SettingsUpdateResponse, Token, User } from "@books/shared"
import Api from "../src/app/api/Api.ts"

void test("trusted constructor copies preserve defaults and discard undeclared properties", () => {
	const input: unknown = JSON.parse("{\"email\":\"reader@example.com\",\"unexpected\":true,\"constructor\":\"bad\",\"__proto__\":{\"polluted\":true}}")
	const request = LoginRequest.fromUnknown(input)
	assert.equal(request.email, "reader@example.com")
	assert.equal(request.password, "")
	assert.equal(request.type, "LoginRequest")
	assert.equal(request.constructor, LoginRequest)
	assert.equal("unexpected" in request, false)
	assert.equal("polluted" in request, false)
	assert.equal(new LoginRequest({}).email, "")
})

void test("JSON boundaries reject wrong primitive, enum, nested and date values", () => {
	assert.throws(() => LoginRequest.fromUnknown({ email: 42 }), Error)
	assert.throws(() => LoginRequest.fromUnknown({ type: "UserRequest" }), Error)
	assert.throws(() => ChangeBookStatusRequest.fromUnknown({ status: "invalid" }), Error)
	assert.throws(() => Token.fromUnknown({ type: "Token", user: { id: "reader", email: 42 }, authorization: "authorization", checksum: "checksum" }), Error)
	assert.throws(() => Book.fromUnknown({ ...new Book().toJSON(), uploadTime: "not a date" }), Error)
	assert.throws(() => Book.fromUnknown({ ...new Book().toJSON(), duration: Infinity }), Error)
	const directory = { ...new AudibleImportDirectory().toJSON(), items: [{ ...new AudibleImportBook().toJSON(), importStatus: "invalid" }] }
	assert.throws(() => AudibleImportDirectory.fromUnknown(directory), Error)
	assert.throws(() => AudibleImportResponse.fromUnknown({ type: "AudibleImportResponse", snapshot: { books: [] } }), Error)
})

void test("settings validation restores typed settings and response fields are assigned", () => {
	const update = SettingsUpdate.fromUnknown(JSON.parse(JSON.stringify(new SettingsUpdate())))
	assert.equal(typeof update.settings.baseBooksPath, "string")
	const response = SettingsUpdateResponse.fromUnknown({ type: "SettingsUpdateResponse", successful: true, message: "Saved" })
	assert.equal(response.successful, true)
	assert.equal(response.message, "Saved")
})

void test("token JSON validation restores the existing user class and numeric dates", t => {
	t.mock.method(console, "error", () => undefined)
	const token = new Token({ user: new User({ id: "reader", email: "reader@example.com", lastLogin: new Date(1234) }), authorization: "authorization", checksum: "checksum" })
	const parsed = Token.fromJSON(JSON.stringify(token))
	assert.ok(parsed instanceof Token)
	assert.ok(parsed.user instanceof User)
	assert.equal(parsed.user.lastLogin?.getTime(), 1234)
	assert.equal(Token.fromJSON("{"), undefined)
	assert.equal(Token.fromJSON("{\"type\":\"Token\",\"user\":false}"), undefined)
})

void test("API responses validate the selected model before exposing its properties", async t => {
	t.mock.method(globalThis, "fetch", () => Promise.resolve(Response.json({ type: "Token", user: "invalid" })))
	await assert.rejects(Api.auth("reader@example.com", "password", () => undefined), Error)
})
