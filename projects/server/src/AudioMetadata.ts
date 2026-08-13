import {
	File as TagLibFile,
	Id3v2Tag,
	Mpeg4BoxHeader,
	Mpeg4File,
	Mpeg4IsoChunkLargeOffset,
	Mpeg4IsoChunkOffsetBox,
	Picture,
	ReadStyle,
	type Tag,
	TagTypes,
} from "node-taglib-sharp"

interface ReadAudioMetadataOptions {
	duration?: boolean,
	picture?: boolean,
}

// Work around node-taglib-sharp#124: 6.0.3 rejects negative size and chunk-offset deltas when MPEG-4 metadata shrinks.
Mpeg4BoxHeader.prototype.overwrite = function (file: TagLibFile, sizeChange: number) {
	if (!Number.isSafeInteger(sizeChange)) {
		throw new Error("Argument out of range: sizeChange must be a safe JS integer")
	}

	if (Reflect.get(this, "_fromDisk") !== true) {
		throw new Error("Cannot overwrite headers not on disk.")
	}

	const position: unknown = Reflect.get(this, "_position")
	const oldHeaderSize = this.headerSize

	if (typeof position !== "number" || !Number.isSafeInteger(position)) {
		throw new Error("Invalid MPEG-4 box header position")
	}

	this.dataSize += sizeChange
	file.insert(this.render(), position, oldHeaderSize)

	return sizeChange + this.headerSize - oldHeaderSize
}

const updateMpeg4ChunkOffsets = (box: Mpeg4IsoChunkOffsetBox | Mpeg4IsoChunkLargeOffset, sizeDifference: number, after: number) => {
	if (!Number.isSafeInteger(sizeDifference)) {
		throw new Error("Argument out of range: sizeDifference must be a safe JS integer")
	}
	if (!Number.isSafeInteger(after) || after < 0) {
		throw new Error("Argument out of range: after must be a safe, positive JS integer")
	}

	const offsetTable: unknown = Reflect.get(box, "_offsetTable")

	if (!Array.isArray(offsetTable) || !offsetTable.every(offset => typeof offset === "number")) {
		throw new Error("Invalid MPEG-4 chunk offset table")
	}

	for (const [index, offset] of offsetTable.entries()) {
		if (offset >= after) {
			offsetTable[index] = offset + sizeDifference
		}
	}
}

Mpeg4IsoChunkOffsetBox.prototype.updatePositions = function (sizeDifference: number, after: number) {
	updateMpeg4ChunkOffsets(this, sizeDifference, after)
}

Mpeg4IsoChunkLargeOffset.prototype.updatePosition = function (sizeDifference: number, after: number) {
	updateMpeg4ChunkOffsets(this, sizeDifference, after)
}

export const readAudioMetadata = (filePath: string, options: ReadAudioMetadataOptions = {}) => {
	const readStyle = (options.duration ? ReadStyle.Average : ReadStyle.None) | (options.picture ? 0 : ReadStyle.PictureLazy)
	const file = TagLibFile.createFromPath(filePath, undefined, readStyle)

	try {
		const tag = file.tag
		const picture = options.picture ? tag.pictures[0] : undefined
		const duration = options.duration ? file.properties.durationMilliseconds / 1000 : undefined
		const title = tag.title as string | undefined
		const comment = tag.comment as string | undefined

		return {
			title: title ?? "",
			performers: tag.performers,
			year: tag.year,
			comment: comment ?? "",
			composers: tag.composers,
			genres: tag.genres,
			picture: picture ? Uint8Array.from(picture.data) : new Uint8Array(),
			duration: duration ?? 0,
		}
	}
	finally {
		file.dispose()
	}
}

export const writeAudioMetadata = (filePath: string, metadata: Pick<Tag, "title" | "performers" | "year" | "comment" | "composers" | "genres">) => {
	const file = TagLibFile.createFromPath(filePath, undefined, ReadStyle.None)

	try {
		Id3v2Tag.language = "eng"
		const tag = file instanceof Mpeg4File ? file.getTag(TagTypes.Apple, true) : file.tag

		tag.title = metadata.title
		tag.performers = metadata.performers
		tag.year = metadata.year
		tag.comment = metadata.comment
		tag.composers = metadata.composers
		tag.genres = metadata.genres
		file.save()
	}
	finally {
		file.dispose()
	}
}

export const writeMp3Cover = (filePath: string, picturePath: string) => {
	const file = TagLibFile.createFromPath(filePath, undefined, ReadStyle.None)

	try {
		const tag = file.getTag(TagTypes.Id3v2, true)

		if (!(tag instanceof Id3v2Tag)) {
			throw new Error(`${filePath}: file does not contain a writable ID3v2 tag`)
		}

		tag.pictures = [Picture.fromPath(picturePath)]
		file.save()
	}
	finally {
		file.dispose()
	}
}
