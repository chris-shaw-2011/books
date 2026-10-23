import { URL, pathToFileURL } from "node:url"
import process from "node:process"

interface LibationAsset {
	name: string,
	digest?: string,
	browser_download_url: string,
}

interface LibationRelease {
	tag_name: string,
	assets?: LibationAsset[],
}

const releaseUrl = "https://api.github.com/repos/rmcrackan/Libation/releases/latest"

export function selectAsset(release: LibationRelease, architecture: string) {
	if (!["amd64", "arm64"].includes(architecture)) throw new Error(`Unsupported Libation architecture: ${architecture}`)
	const match = /^v(\d+\.\d+\.\d+)$/.exec(release.tag_name)
	if (!match) throw new Error("Latest Libation release has an unexpected tag")
	const name = `Libation.${match[1]}-linux-chardonnay-${architecture}.deb`
	const asset = release.assets?.find(candidate => candidate.name === name)
	if (!asset?.digest || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) throw new Error(`Latest Libation release has no verified ${architecture} Debian package`)
	const url = new URL(asset.browser_download_url)
	if (url.protocol !== "https:" || url.hostname !== "github.com" || url.pathname !== `/rmcrackan/Libation/releases/download/${release.tag_name}/${name}`) throw new Error("Unexpected Libation download URL")
	return { version: match[1], sha256: asset.digest.slice(7), url: url.href }
}

async function main() {
	const response = await fetch(releaseUrl, { headers: { "accept": "application/vnd.github+json", "user-agent": "books-container-build" } })
	if (!response.ok) throw new Error(`Could not resolve latest Libation release: HTTP ${response.status}`)
	const release = await response.json() as LibationRelease
	process.stdout.write(`${JSON.stringify(selectAsset(release, process.argv[2] ?? ""))}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
	process.exitCode = 1
})
