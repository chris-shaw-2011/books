import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import test from "node:test"
import { fileURLToPath } from "node:url"

void test("code versions keep three parts and automatic dependency revisions use four", () => {
	const root = mkdtempSync(join(tmpdir(), "books-versions-"))
	try {
		const repo = join(root, "work")
		mkdirSync(repo)
		const output = join(root, "output")
		const env = {
			...process.env, GITHUB_OUTPUT: output,
			GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.invalid",
			GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.invalid",
		}
		const run = (command: string, args: string[]) => {
			const result = spawnSync(command, args, { cwd: repo, env, encoding: "utf8" })
			assert.equal(result.status, 0, result.stdout + result.stderr)
			return result.stdout.trim()
		}
		const git = (...args: string[]) => run("git", args)
		const setVersion = (version: string) => {
			writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "fixture", private: true, version }))
			writeFileSync(join(repo, "package-lock.json"), JSON.stringify({ name: "fixture", version, lockfileVersion: 3, packages: { "": { name: "fixture", version } } }))
		}
		const commit = (message: string) => {
			git("add", ".")
			git("commit", "--allow-empty", "-m", message)
			return git("rev-parse", "HEAD")
		}
		const bump = (expected: string) => {
			assert.equal(run(process.execPath, [fileURLToPath(new URL("./bump-update-version.ts", import.meta.url))]), expected)
			const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as { version: string }
			const lock = JSON.parse(readFileSync(join(repo, "package-lock.json"), "utf8")) as { version: string, packages: Record<string, { version: string }> }
			assert.equal(pkg.version, expected)
			assert.equal(lock.version, expected)
			assert.equal(lock.packages[""]?.version, expected)
		}

		const tag = () => {
			writeFileSync(output, "")
			run("bash", [fileURLToPath(new URL("./tag-version.sh", import.meta.url))])
			return Object.fromEntries(readFileSync(output, "utf8").trim().split("\n").map(line => line.split("="))) as Record<string, string>
		}
		git("init", "--bare", join(root, "remote.git"))
		git("init", "-b", "master")
		git("remote", "add", "origin", join(root, "remote.git"))
		setVersion("1.7.0")
		commit("code release")
		assert.deepEqual(tag(), { changed: "true", version: "1.7.0" })
		assert.deepEqual(tag(), { changed: "false", version: "1.7.0" })

		bump("1.7.0.1")
		const first = commit("dependency update")
		assert.deepEqual(tag(), { changed: "true", version: "1.7.0.1" })
		assert.equal(git("rev-parse", "latest"), first)
		assert.equal(git("rev-parse", "1.7.0.1"), first)
		assert.deepEqual(tag(), { changed: "false", version: "1.7.0.1" }, "retry reuses the existing tag")

		bump("1.7.0.2")
		commit("another dependency update")
		assert.deepEqual(tag(), { changed: "true", version: "1.7.0.2" })
		setVersion("1.7.0.9")
		bump("1.7.0.10")
		commit("multi-digit automatic revision")
		assert.deepEqual(tag(), { changed: "true", version: "1.7.0.10" })
		commit("unreleased source changes")
		assert.deepEqual(tag(), { changed: "false", version: "1.7.0.10" })
		setVersion("1.7.1")
		commit("new code release")
		assert.deepEqual(tag(), { changed: "true", version: "1.7.1" })
		bump("1.7.1.1")
		commit("dependency update after code release")
		assert.deepEqual(tag(), { changed: "true", version: "1.7.1.1" })
	}
	finally {
		rmSync(root, { recursive: true, force: true })
	}
})
