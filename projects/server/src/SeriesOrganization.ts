import fs from "node:fs/promises"
import path from "node:path"
import sanitize from "sanitize-filename"

const validateSeriesFolder = (folderPath: string) => {
	if (typeof folderPath !== "string" || !folderPath.startsWith("/") || folderPath.includes("\\") || (folderPath !== "/" && folderPath.split("/").slice(1).some(part => !part || sanitize(part) !== part || part === "." || part === ".."))) throw new Error("Choose a valid series folder inside the library")
}

const inside = (root: string, destination: string) => {
	const relative = path.relative(root, destination)
	return !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

export async function seriesDestination(baseBooksPath: string, folderPath: string) {
	validateSeriesFolder(folderPath)
	const configuredRoot = path.resolve(baseBooksPath)
	const root = await fs.realpath(baseBooksPath)
	const destination = path.resolve(configuredRoot, `.${folderPath}`)
	if (!inside(configuredRoot, destination)) throw new Error("Series folder is outside the library")
	let existing = destination
	for (;;) {
		try {
			if (!inside(root, await fs.realpath(existing))) throw new Error("Series folder links outside the library")
			break
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
			existing = path.dirname(existing)
		}
	}
	await fs.mkdir(destination, { recursive: true })
	if (!inside(root, await fs.realpath(destination))) throw new Error("Series folder links outside the library")
	return destination
}
