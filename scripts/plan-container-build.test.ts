import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import test from "node:test"
import { fileURLToPath } from "node:url"

void test("container decisions skip unchanged inputs, explain every change and preserve version numbering", () => {
	const dir = mkdtempSync(join(tmpdir(), "books-container-plan-"))
	try {
		const output = join(dir, "output")
		const summary = join(dir, "summary")
		const plan = (overrides: Record<string, string> = {}) => {
			writeFileSync(output, "")
			writeFileSync(summary, "")
			const result = spawnSync("bash", [fileURLToPath(new URL("./plan-container-build.sh", import.meta.url))], {
				encoding: "utf8",
				env: {
					...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
					RELEASE_REQUESTED: "false", RELEASE_VERSION: "1.7.5",
					PREVIOUS_FOUND: "true", PREVIOUS_VERSION: "1.7.5.0.0", PREVIOUS_RELEASE_VERSION: "1.7.5",
					PREVIOUS_BASE_DIGEST: "sha256:base", CURRENT_BASE_DIGEST: "sha256:base",
					PREVIOUS_LIBATION_SHA256: "libation", CURRENT_LIBATION_SHA256: "libation", CURRENT_LIBATION_VERSION: "14.2.5",
					APT_UPGRADE_COUNT: "0", APT_CHECKED: "success", ...overrides,
				},
			})
			assert.equal(result.status, 0, result.stdout + result.stderr)
			return {
				values: Object.fromEntries(readFileSync(output, "utf8").trim().split("\n").map(line => line.split("="))) as Record<string, string>,
				summary: readFileSync(summary, "utf8"),
			}
		}
		const unchanged = plan()
		assert.equal(unchanged.values["target-version"], "")
		assert.equal(unchanged.values["publish-name"], "Publish container — skipped, no updates")
		assert.match(unchanged.summary, /No container build/)
		assert.match(unchanged.summary, /publishing are skipped/)

		const base = plan({ CURRENT_BASE_DIGEST: "sha256:new-base", PREVIOUS_VERSION: "1.7.5.0.9", APT_CHECKED: "skipped" })
		assert.equal(base.values["target-version"], "1.7.5.0.10")
		assert.equal(base.values["publish-name"], "Publish 1.7.5.0.10 — Node base image updated")
		assert.match(base.summary, /Check skipped/)

		const libation = plan({ CURRENT_LIBATION_SHA256: "new-libation" })
		assert.equal(libation.values["target-version"], "1.7.5.0.1")
		assert.equal(libation.values["publish-name"], "Publish 1.7.5.0.1 — Libation 14.2.5 available")

		const apt = plan({ APT_UPGRADE_COUNT: "3" })
		assert.equal(apt.values["target-version"], "1.7.5.0.1")
		assert.match(apt.values["publish-name"] ?? "", /3 Debian package upgrades/)

		const release = plan({ RELEASE_REQUESTED: "true", RELEASE_VERSION: "1.7.5.1", CURRENT_BASE_DIGEST: "new", CURRENT_LIBATION_SHA256: "new" })
		assert.equal(release.values["target-version"], "1.7.5.1.0")
		assert.match(release.values["publish-name"] ?? "", /Publish 1\.7\.5\.1\.0 — application release 1\.7\.5\.1 requested; Node base image updated; Libation 14\.2\.5 available/)

		const unpublished = plan({ RELEASE_VERSION: "1.7.6" })
		assert.equal(unpublished.values["target-version"], "", "a version mismatch alone must not automatically recover a failed release")

		const manual = plan({ RELEASE_REQUESTED: "true" })
		assert.equal(manual.values["target-version"], "1.7.5.0.1")
		assert.equal(manual.values["publish-name"], "Publish 1.7.5.0.1 — application release 1.7.5 requested")

		const first = plan({ RELEASE_REQUESTED: "true", PREVIOUS_FOUND: "false", PREVIOUS_VERSION: "", PREVIOUS_RELEASE_VERSION: "" })
		assert.equal(first.values["target-version"], "1.7.5.0.0")
		assert.equal(first.values["publish-name"], "Publish 1.7.5.0.0 — application release 1.7.5 requested")
	}
	finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
