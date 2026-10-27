// Run inside the production image as its default (non-root) user.
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import process from "node:process"

const requireProduction = createRequire("/home/node/app/bin/package.json")
const staging = mkdtempSync(join(tmpdir(), "books-image-check-"))
const env = { ...process.env, HOME: staging, LIBATION_FILES_DIR: staging }
const paths = process.env as Record<"FFMPEG_PATH" | "FFPROBE_PATH", string>

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
	execFileSync(paths.FFMPEG_PATH, ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "0.1", "-c:a", "aac", audio], { timeout: 30000 })
	execFileSync(paths.FFPROBE_PATH, ["-v", "error", audio], { timeout: 30000 })
	const pty = requireProduction("node-pty") as typeof import("node-pty")
	await new Promise<void>((resolve, reject) => {
		let output = ""
		let finished = false
		const terminal = pty.spawn("libationcli", ["login-external", "-a", "books-container-check@example.invalid", "-l", "us"], { env, cwd: staging })
		const timer = setTimeout(() => {
			if (finished) return
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
			if (finished) return
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
