import assert from "node:assert/strict"
import test from "node:test"
import DownloadProgress from "../../src/audible/DownloadProgress.ts"

void test("reads Libation terminal bars across PTY chunks and backspace redraws", () => {
	const progress = new DownloadProgress()
	assert.equal(progress.update("Downloading\r\n[..........]  ETA 1:00"), 0)
	assert.equal(progress.update(`${"\b".repeat(25)}[###`), undefined)
	assert.equal(progress.update("##.....]  ETA 0:30"), 50)
	assert.equal(progress.update(`${"\b".repeat(25)}[########..] ETA 0:10${"\b".repeat(25)}[##########] ETA 0:00`), 100)
	assert.equal(progress.update(`${"\b".repeat(25)}${" ".repeat(25)}`), undefined)
})

void test("reads percentages split around ANSI sequences and uses the latest frame", () => {
	const progress = new DownloadProgress()
	assert.equal(progress.update("\x1b[32m42."), undefined)
	assert.equal(progress.update("5\x1b[0m%"), 42.5)
	assert.equal(progress.update("\r 55%\r 72,5%"), 72.5)
	assert.equal(progress.update("\r 100%"), 100)
	assert.equal(progress.update("\r 100%"), undefined)
})
