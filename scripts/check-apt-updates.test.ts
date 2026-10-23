import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import process from "node:process"
import { fileURLToPath } from "node:url"

void test("counts available upgrades from the installed image and propagates APT failures", () => {
	const directory = mkdtempSync(join(tmpdir(), "books-apt-check-"))
	try {
		const apt = join(directory, "apt-get")
		writeFileSync(apt, [
			"#!/bin/sh",
			"if [ \"$1\" = \"update\" ]; then exit \"${MOCK_UPDATE_EXIT:-0}\"; fi",
			"printf \"%s\\n\" \"$MOCK_PLAN\"",
			"exit \"${MOCK_SIM_EXIT:-0}\"",
			"",
		].join("\n"))
		chmodSync(apt, 0o755)
		const run = (plan: string, extra: Record<string, string> = {}) => spawnSync("sh", [fileURLToPath(new URL("./check-apt-updates.sh", import.meta.url))], {
			encoding: "utf8",
			env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, MOCK_PLAN: plan, ...extra },
		})
		assert.equal(run("0 upgraded, 0 newly installed").stdout.trim(), "0")
		const upgrades = run("Inst curl [1] (2 Debian)\nInst ffmpeg [1] (2 Debian)\n2 upgraded, 0 newly installed")
		assert.equal(upgrades.status, 0)
		assert.equal(upgrades.stdout.trim(), "2")
		assert.notEqual(run("", { MOCK_UPDATE_EXIT: "1" }).status, 0)
		assert.notEqual(run("", { MOCK_SIM_EXIT: "1" }).status, 0)
	}
	finally {
		rmSync(directory, { recursive: true, force: true })
	}
})
