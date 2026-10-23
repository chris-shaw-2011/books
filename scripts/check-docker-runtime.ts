// Run inside the production image as its default (non-root) user.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import process from "node:process"

const requireProduction = createRequire("/home/node/app/bin/package.json")
const staging = mkdtempSync(join(tmpdir(), "books-image-check-"))
assert.notEqual(process.getuid?.(), 0, "The image must run as non-root")
const env = { ...process.env, HOME: staging, LIBATION_FILES_DIR: staging }

try {
	mkdirSync(join(staging, "audio"))
	writeFileSync(join(staging, "Settings.json"), JSON.stringify({
		Books: join(staging, "audio"),
		InProgress: join(staging, "inprogress"),
		Serilog: {
			MinimumLevel: "Fatal",
			WriteTo: [{
				Name: "File",
				Args: { path: join(staging, "libation.log") },
			}],
		},
	}), { mode: 0o600 })
	const version = execFileSync("libationcli", ["version"], { env, encoding: "utf8", timeout: 30000 })
	const expectedVersion = readFileSync("/usr/local/share/books/libation-version", "utf8").trim()
	assert.match(expectedVersion, /^\d+\.\d+\.\d+$/)
	assert.match(version, new RegExp(`\\bv${expectedVersion.replaceAll(".", "\\.")}\\b`))
	execFileSync("libationcli", ["login-external", "--help"], { env, timeout: 30000 })
	const audio = join(staging, "runtime-check.m4b")
	assert.equal(process.env.FFMPEG_PATH, "/usr/bin/ffmpeg")
	assert.equal(process.env.FFPROBE_PATH, "/usr/bin/ffprobe")
	execFileSync(process.env.FFMPEG_PATH, ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "0.1", "-c:a", "aac", audio], { timeout: 30000 })
	const probe = execFileSync(process.env.FFPROBE_PATH, ["-v", "error", "-show_format", "-show_streams", "-show_chapters", "-count_packets", "-of", "json", audio], { encoding: "utf8", timeout: 30000 })
	assert.ok((JSON.parse(probe) as { streams?: { codec_type?: string, nb_read_packets?: string }[] }).streams?.some(stream => stream.codec_type === "audio" && Number(stream.nb_read_packets) > 0))
	const pty = requireProduction("node-pty") as typeof import("node-pty")
	const expectPtyOutput = (file: string, args: string[], expected: RegExp, timeout: number) => new Promise<void>((resolve, reject) => {
		let output = ""
		let finished = false
		const terminal = pty.spawn(file, args, { env, cwd: staging })
		const timer = setTimeout(() => {
			if (finished) return
			finished = true
			terminal.kill()
			reject(new Error(`${file} PTY smoke check timed out`))
		}, timeout)

		terminal.onData(data => {
			output = (output + data).slice(-64000)

			if (!finished && expected.test(output)) {
				finished = true
				clearTimeout(timer)
				terminal.kill()
				resolve()
			}
		})
		terminal.onExit(({ exitCode }) => {
			if (finished) return
			finished = true
			clearTimeout(timer)
			reject(new Error(`${file} exited with code ${exitCode} before producing expected output`))
		})
	})

	await expectPtyOutput("/bin/sh", ["-c", "printf books-pty-ok"], /books-pty-ok/, 10000)
	await expectPtyOutput("libationcli", ["login-external", "-a", "books-container-check@example.invalid", "-l", "us"], /https:\/\/www\.amazon\.com\/ap\/signin\?/, 30000)
	process.stdout.write(`Libation ${expectedVersion}, external login, FFprobe, writable staging, non-root UID and native PTY verified\n`)
}
finally {
	rmSync(staging, { recursive: true, force: true })
}
