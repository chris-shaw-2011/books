import typia from "typia"

interface ChapterTag {
	title: string,
}

export interface Chapter {
	id: number,
	time_base: string,
	start: number,
	end: number,
	tags: ChapterTag,
}

export interface Chapters {
	chapters: Chapter[],
}

export const Chapters = { fromUnknown: typia.createAssert<Chapters>() }
