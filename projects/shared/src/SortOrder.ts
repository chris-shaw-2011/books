export const SortOrderValues = ["Alphabetically - Ascending", "Alphabetically - Descending", "Uploaded - Ascending", "Uploaded - Descending"] as const

export type SortOrder = typeof SortOrderValues[number]
