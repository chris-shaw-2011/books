import typia, { type tags } from "typia"

// Fields used from https://github.com/rmcrackan/Libation/blob/master/Source/ApplicationServices/ExportDto.cs.
export default interface LibationBook {
	AudibleProductId: string & tags.Pattern<"\\S">,
	Title: string & tags.Pattern<"\\S">,
	AuthorNames: string,
	NarratorNames: string,
	Description: string,
	CategoriesNames: string,
	SeriesOrder: string,
	ContentType: string,
	LengthInMinutes: number & tags.Type<"int32"> & tags.Minimum<0>,
	DatePublished: string | null,
	PictureId: string | null,
	PictureLarge: string | null,
}

export const LibationLibrary = {
	fromUnknown(json: unknown) {
		return typia.assert<LibationBook[]>(json, ({ path, expected }) => new Error(`Invalid Libation library export: ${path} must be ${expected}`))
	},
}
