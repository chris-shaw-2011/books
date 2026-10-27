import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import process from "node:process"

interface LockedPackage {
	dev?: boolean,
	link?: boolean,
	version?: string,
	resolved?: string,
	integrity?: string,
}
interface Lockfile { packages: Record<string, LockedPackage> }

const lockPath = "package-lock.json"
const original = readFileSync(lockPath, "utf8")
const before = JSON.parse(original) as Lockfile
const productionPackages = (lock: Lockfile) => Object.entries(lock.packages)
	.filter(([path, pkg]) => path.includes("node_modules/") && !pkg.dev && !pkg.link)
	.sort(([a], [b]) => a.localeCompare(b))
const snapshot = (lock: Lockfile) => JSON.stringify(productionPackages(lock).map(([path, pkg]) => [
	path, pkg.version, pkg.resolved, pkg.integrity,
]))

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

const after = JSON.parse(readFileSync(lockPath, "utf8")) as Lockfile
if (snapshot(before) === snapshot(after)) {
	// npm may normalize metadata or dev entries. Neither warrants a release.
	writeFileSync(lockPath, original)
	process.stdout.write("No production dependency changes.\n")
}
