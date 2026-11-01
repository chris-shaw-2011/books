import type { LibationBook } from "@books/shared"

export default function libationBook(overrides: Partial<LibationBook> & { IsAudiblePlus?: boolean, SeriesNames?: string } = {}): LibationBook {
	return {
		AudibleProductId: "ASIN",
		Title: "A book",
		AuthorNames: "",
		NarratorNames: "",
		Description: "",
		CategoriesNames: "",
		SeriesOrder: "",
		ContentType: "Product",
		LengthInMinutes: 0,
		DatePublished: null,
		PictureId: null,
		PictureLarge: null,
		...overrides,
	}
}
