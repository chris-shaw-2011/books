import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { File, Mpeg4AppleTag, ReadStyle, TagTypes } from "node-taglib-sharp"
import { readAudioMetadata } from "../AudioMetadata.ts"

export const readAsin = (filePath: string) => readAudioMetadata(filePath).asin

export function writeAsin(filePath: string, asin: string) {
	const file = File.createFromPath(filePath, undefined, ReadStyle.None)

	try {
		const tag = file.getTag(TagTypes.Apple, true)

		if (!(tag instanceof Mpeg4AppleTag)) {
			throw new Error("M4B metadata is unavailable")
		}

		tag.setItunesStrings("com.apple.iTunes", "ASIN", asin)

		file.save()
	}
	finally {
		file.dispose()
	}
}

export async function audioFiles(directory: string) {
	const result: string[] = []

	for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name)

		if (entry.isDirectory()) {
			result.push(...(await audioFiles(fullPath)))
		}
		else if (entry.isFile() && /\.m4b$/i.test(entry.name)) {
			result.push(fullPath)
		}
	}

	return result
}

export async function publishAudio(source: string, destination: string, name: string) {
	// Copy into a non-audio extension on the destination filesystem, then link atomically.
	// The watcher cannot see partial audio; link also guarantees no overwrite.
	const hidden = path.join(destination, `.audible-${randomUUID()}.staging`)

	await fs.mkdir(destination, { recursive: true })

	try {
		await fs.copyFile(source, hidden)

		for (let suffix = 0; ; suffix++) {
			const target = path.join(destination, `${name}${suffix ? ` (${suffix})` : ""}.m4b`)

			try {
				await fs.link(hidden, target)

				return target
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
					throw error
				}
			}
		}
	}
	finally {
		await fs.rm(hidden, { force: true })
	}
}
