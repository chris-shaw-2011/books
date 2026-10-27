import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import test from "node:test"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./update-production-dependencies.ts", import.meta.url))

void test("daily updates preserve dev dependencies and skip dev-only releases", async () => {
	const root = mkdtempSync(join(tmpdir(), "books-production-update-"))
	let registry = ""
	let requests = 0
	let tarballs = 0
	let failAudit = false
	const server = createServer((request, response) => {
		requests++
		response.setHeader("content-type", "application/json")
		if (request.url?.startsWith("/-/npm/v1/security/")) {
			response.writeHead(failAudit ? 503 : 200)
			response.end(JSON.stringify(failAudit ? { error: "Fixture registry failure" } : {}))
			return
		}
		const name = decodeURIComponent(request.url?.slice(1) ?? "")
		if (name.includes("/-/")) tarballs++
		const versions = Object.fromEntries(["1.0.0", "1.0.1", "2.0.0"].map(version => [version, {
			name,
			version,
			...(name === "fixture-runtime" && { dependencies: { "fixture-leaf": "^1.0.0" } }),
			dist: {
				tarball: `${registry}/${name}/-/${version}.tgz`,
				integrity: `sha512-${Buffer.from(version).toString("base64")}`,
			},
		}]))
		response.end(JSON.stringify({ name, "dist-tags": { latest: "2.0.0" }, versions }))
	})
	try {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject)
			server.listen(0, "127.0.0.1", resolve)
		})
		const address = server.address()
		assert.ok(address && typeof address !== "string")
		registry = `http://127.0.0.1:${address.port}`
		const fixture = (name: string, production = true) => {
			const dir = join(root, name)
			mkdirSync(join(dir, "projects/app"), { recursive: true })
			const pkg = { name: "fixture", version: "1.0.0.1", private: true, workspaces: ["projects/*"], scripts: { postinstall: "touch installed-marker" } }
			const app = {
				name: "fixture-app", version: "1.0.0",
				...(production && { dependencies: { "fixture-runtime": "1.0.0" }, optionalDependencies: { "@fixture/optional": "^1.0.0" } }),
				devDependencies: { "fixture-lint": "^1.0.0", "fixture-build": "^1.0.0" },
			}
			const packages: Record<string, unknown> = { "": pkg, "projects/app": app, "node_modules/fixture-app": { resolved: "projects/app", link: true } }
			for (const dependency of ["fixture-runtime", "fixture-leaf", "@fixture/optional", "fixture-lint", "fixture-build"]) {
				const dev = ["fixture-lint", "fixture-build"].includes(dependency)
				if (!production && !dev) continue
				packages[`node_modules/${dependency}`] = {
					version: "1.0.0", resolved: `${registry}/${dependency}/-/1.0.0.tgz`, integrity: `sha512-${Buffer.from("1.0.0").toString("base64")}`,
					...(dev && { dev: true }),
					...(dependency === "@fixture/optional" && { optional: true }),
					...(dependency === "fixture-runtime" && { dependencies: { "fixture-leaf": "^1.0.0" } }),
				}
			}
			writeFileSync(join(dir, "package.json"), JSON.stringify(pkg))
			writeFileSync(join(dir, "projects/app/package.json"), JSON.stringify(app))
			writeFileSync(join(dir, "package-lock.json"), `${JSON.stringify({ name: "fixture", version: "1.0.0.1", lockfileVersion: 3, requires: true, packages }, null, "\t")}\n`)
			return dir
		}
		const run = (cwd: string) => new Promise<{ status: number | null, output: string }>((resolve, reject) => {
			const env = { ...process.env, npm_config_registry: registry, npm_config_cache: join(root, "cache"), npm_config_fetch_retries: "0", npm_config_update_notifier: "false", NPM_CONFIG_USERCONFIG: "/dev/null" }
			const child = spawn(process.execPath, [script], { cwd, env })
			let output = ""
			child.stdout.on("data", data => {
				output += String(data)
			})
			child.stderr.on("data", data => {
				output += String(data)
			})
			child.on("error", reject)
			child.on("close", status => resolve({ status, output }))
		})

		const dir = fixture("production")
		const result = await run(dir)
		assert.equal(result.status, 0, result.output)
		const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8")) as { packages: Record<string, { version: string }> }
		assert.equal(lock.packages["node_modules/fixture-runtime"]?.version, "1.0.0", "exact pins stay pinned")
		assert.equal(lock.packages["node_modules/fixture-leaf"]?.version, "1.0.1", "production transitive dependencies update within range")
		assert.equal(lock.packages["node_modules/@fixture/optional"]?.version, "1.0.1", "scoped optional production dependencies update")
		assert.equal(lock.packages["node_modules/fixture-lint"]?.version, "1.0.0")
		assert.equal(lock.packages["node_modules/fixture-build"]?.version, "1.0.0")
		assert.equal(existsSync(join(dir, "node_modules")), false)
		assert.equal(existsSync(join(dir, "installed-marker")), false)
		assert.equal(tarballs, 0)
		const stable = readFileSync(join(dir, "package-lock.json"), "utf8")
		const unchanged = await run(dir)
		assert.equal(unchanged.status, 0, unchanged.output)
		assert.match(unchanged.output, /No production dependency changes/)
		assert.equal(readFileSync(join(dir, "package-lock.json"), "utf8"), stable, "dev-only updates cannot create a lockfile diff")

		const devOnly = fixture("dev-only", false)
		const previousRequests = requests
		const original = readFileSync(join(devOnly, "package-lock.json"), "utf8")
		assert.equal((await run(devOnly)).status, 0)
		assert.equal(requests, previousRequests)
		assert.equal(readFileSync(join(devOnly, "package-lock.json"), "utf8"), original)

		failAudit = true
		assert.notEqual((await run(dir)).status, 0, "registry failures must fail the updater")
	}
	finally {
		await new Promise<void>(resolve => server.close(() => resolve()))
		rmSync(root, { recursive: true, force: true })
	}
})
