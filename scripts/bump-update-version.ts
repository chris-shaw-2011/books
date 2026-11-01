import { PackageManifest, VersionedLockfile } from "../projects/shared/src/PackageMetadata.ts"
import { readFileSync, writeFileSync } from "node:fs"
import process from "node:process"

const pkg = PackageManifest.fromUnknown(JSON.parse(readFileSync("package.json", "utf8")))
const lock = VersionedLockfile.fromUnknown(JSON.parse(readFileSync("package-lock.json", "utf8")))

if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(pkg.version)) {
	throw new Error(`Invalid application version: ${pkg.version}`)
}

const parts = pkg.version.split(".")
const revision = Number(parts[3] ?? 0) + 1

pkg.version = `${parts.slice(0, 3).join(".")}.${revision}`
lock.version = pkg.version
lock.packages[""].version = pkg.version
writeFileSync("package.json", `${JSON.stringify(pkg, null, "\t")}\n`)
writeFileSync("package-lock.json", `${JSON.stringify(lock, null, "\t")}\n`)
process.stdout.write(`${pkg.version}\n`)
