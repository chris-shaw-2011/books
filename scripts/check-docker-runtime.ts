// Run inside the production image as its default (non-root) user.
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import process from "node:process"

const requireProduction = createRequire("/home/node/app/bin/package.json")
const ffmpegPath = process.env.FFMPEG_PATH
const ffprobePath = process.env.FFPROBE_PATH

if (!ffmpegPath || !ffprobePath) {
	throw new Error("FFMPEG_PATH and FFPROBE_PATH must be configured")
}

const isPtyModule = (value: unknown): value is Pick<typeof import("node-pty"), "spawn"> =>
	typeof value === "object" && value !== null && "spawn" in value && typeof value.spawn === "function"
const staging = mkdtempSync(join(tmpdir(), "books-image-check-"))
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

	process.stdout.write(`Libation CLI reports: ${version.trim()}\n`)

	const audio = join(staging, "runtime-check.m4b")

	execFileSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "0.1", "-c:a", "aac", audio], { timeout: 30000 })
	execFileSync(ffprobePath, ["-v", "error", audio], { timeout: 30000 })
	const pty: unknown = requireProduction("node-pty")

	if (!isPtyModule(pty)) {
		throw new Error("Production node-pty module does not export spawn")
	}

	await new Promise<void>((resolve, reject) => {
		let output = ""
		let finished = false
		const terminal = pty.spawn("libationcli", ["login-external", "-a", "books-container-check@example.invalid", "-l", "us"], { env, cwd: staging })
		const timer = setTimeout(() => {
			if (finished) {
				return
			}

			finished = true
			terminal.kill()
			reject(new Error("Libation external login timed out"))
		}, 30000)

		terminal.onData(data => {
			output = (output + data).slice(-64000)

			if (!finished && output.includes("https://www.amazon.com/ap/signin?")) {
				finished = true
				clearTimeout(timer)
				terminal.kill()
				resolve()
			}
		})
		terminal.onExit(({ exitCode }) => {
			if (finished) {
				return
			}

			finished = true
			clearTimeout(timer)
			reject(new Error(`Libation exited with code ${exitCode} before producing a login URL`))
		})
	})
	process.stdout.write("Libation external login, FFmpeg/FFprobe and writable temporary storage verified\n")
}
finally {
	rmSync(staging, { recursive: true, force: true })
}
