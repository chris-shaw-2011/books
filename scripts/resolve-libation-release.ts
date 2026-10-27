import { pathToFileURL } from "node:url"
import process from "node:process"

interface LibationAsset {
	name: string,
	digest: string,
	browser_download_url: string,
}

interface LibationRelease {
	tag_name: string,
	assets?: LibationAsset[],
}

const releaseUrl = "https://api.github.com/repos/rmcrackan/Libation/releases/latest"

export function selectAsset(release: LibationRelease, architecture: string) {
	const version = release.tag_name.replace(/^v/, "")
	const name = `Libation.${version}-linux-chardonnay-${architecture}.deb`
	const asset = release.assets?.find(candidate => candidate.name === name)
	if (!asset) throw new Error(`Latest Libation release has no ${architecture} Debian package`)
	return { version, sha256: asset.digest.replace(/^sha256:/, ""), url: asset.browser_download_url }
}

async function main() {
	const response = await fetch(releaseUrl, { headers: { "accept": "application/vnd.github+json", "user-agent": "books-container-build" } })
	if (!response.ok) throw new Error(`Could not resolve latest Libation release: HTTP ${response.status}`)
	const release = await response.json() as LibationRelease
	const asset = selectAsset(release, process.argv[2] ?? "")
	process.stdout.write(`${process.argv[3] === "--url" ? asset.url : JSON.stringify(asset)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
	process.exitCode = 1
})
