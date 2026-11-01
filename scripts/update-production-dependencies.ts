import { Lockfile } from "../projects/shared/src/PackageMetadata.ts"
import { spawnSync } from "node:child_process"
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import process from "node:process"

const lockPath = "package-lock.json"
const original = readFileSync(lockPath, "utf8")
const before = Lockfile.fromUnknown(JSON.parse(original))
const productionPackages = (lock: Lockfile) => Object.entries(lock.packages)
	.filter(([path, pkg]) => path.includes("node_modules/") && !pkg.dev && !pkg.link)
	.sort(([a], [b]) => a.localeCompare(b))
// --omit=dev alone still updates dev entries in a lockfile-only operation.
// Select every production package name so transitive updates are included too.
const names = [...new Set(productionPackages(before).map(([path]) => path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length)))].sort()
const runNpm = (args: string[]) => {
	const result = spawnSync("npm", args, { stdio: "inherit" })
	if (result.error) throw result.error
	if (result.status !== 0) process.exit(result.status ?? 1)
}

if (names.length) {
	runNpm(["update", ...names, "--package-lock-only", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--workspaces", "--include-workspace-root"])
	// Keep unresolved advisories visible without blocking compatible fixes.
	// Registry/command errors still fail, and --force is deliberately excluded.
	runNpm(["audit", "fix", "--package-lock-only", "--omit=dev", "--ignore-scripts", "--audit-level=none", "--no-fund", "--workspaces", "--include-workspace-root"])
}

const after = Lockfile.fromUnknown(JSON.parse(readFileSync(lockPath, "utf8")))
const previous = new Map(productionPackages(before))
const current = new Map(productionPackages(after))
const changes = [...new Set([...previous.keys(), ...current.keys()])].filter(path => {
	const a = previous.get(path)
	const b = current.get(path)
	return !a || !b || a.version !== b.version || a.resolved !== b.resolved || a.integrity !== b.integrity
})
const changed = changes.length > 0
if (!changed) {
	// npm may normalize metadata or dev entries. Neither warrants a release.
	writeFileSync(lockPath, original)
	process.stdout.write("No production dependency changes.\n")
}
if (process.env.GITHUB_OUTPUT) {
	appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\ncount=${changes.length}\n`)
}
if (process.env.GITHUB_STEP_SUMMARY) {
	const rows = changes.map(path => `| \`${path.replace(/^node_modules\//, "")}\` | ${previous.get(path)?.version ?? "—"} | ${current.get(path)?.version ?? "removed"} |`)
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, changed ?
		`## Production dependency updates\n\n${changes.length} locked production packages changed.\n\n| Package | Before | After |\n| --- | --- | --- |\n${rows.join("\n")}\n` :
		"## Production dependencies unchanged\n\nNo compatible production updates or security fixes were applied. No dependency commit or automatic version bump is needed.\n")
}
