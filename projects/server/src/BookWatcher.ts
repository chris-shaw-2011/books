import chokidar from "chokidar"
import { execFileSync } from "child_process"
import { type Stats } from "fs"
import path from "path"

const DefaultPollingInterval = 60_000

const ExtensionsToWatch = new Set([
	".mp3",
	".m4b",
])

function shouldUsePolling(baseBooksPath: string) {
	let usePolling = false
	let fileSystem = "local"
	const localFileSystemArgument = process.platform === "darwin" ? "-l" : "--local"

	try {
		// BSD df (including macOS) uses -l; GNU df uses --local.
		execFileSync("df", [localFileSystemArgument, baseBooksPath])
	}
	catch {
		fileSystem = "non-local"
		usePolling = true
	}

	// eslint-disable-next-line no-console
	console.log(`${fileSystem} filesystem detected, usePolling set to ${usePolling}`)

	return usePolling
}

function shouldIgnoreBookPath(checkPath: string, stats?: Stats) {
	if (!stats) {
		return false
	}
	else if (stats.isDirectory()) {
		return false
	}
	else if (ExtensionsToWatch.has(path.extname(checkPath).toLowerCase())) {
		return false
	}
	else {
		// eslint-disable-next-line no-console
		console.log(`Ignoring ${checkPath}`)

		return true
	}
}

export function watchBookFiles(baseBooksPath: string) {
	if (!baseBooksPath) {
		// A books directory is configured after the initial login. Until then,
		// there is nothing to watch and chokidar cannot watch an empty path.
		return chokidar.watch([])
	}

	return chokidar.watch(baseBooksPath, {
		ignored: shouldIgnoreBookPath,
		ignoreInitial: true,
		awaitWriteFinish: {
			stabilityThreshold: 5000,
			pollInterval: 1000,
		},
		ignorePermissionErrors: true,
		usePolling: shouldUsePolling(baseBooksPath),
		interval: DefaultPollingInterval,
		binaryInterval: DefaultPollingInterval,
	})
}
