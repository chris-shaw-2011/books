import { copyFile, cp, mkdir, stat } from "node:fs/promises"
import path from "node:path"

const [source, destination] = process.argv.slice(2)

if (!source || !destination) {
	throw new TypeError("Usage: node ./scripts/copy.ts <source> <destination-directory>")
}

const sourceStats = await stat(source)

if (sourceStats.isDirectory()) {
	await cp(source, destination, { recursive: true })
}
else {
	await mkdir(destination, { recursive: true })
	await copyFile(source, path.join(destination, path.basename(source)))
}
