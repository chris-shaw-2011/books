import { createContext } from "react"
import type { AudibleImportBook, BookSeries, SeriesOrganization } from "@books/shared"

export type SeriesDraft = Omit<SeriesOrganization, "series"> & { series: BookSeries }

interface AudibleImportContextValue {
	selecting: boolean,
	busy: boolean,
	available: AudibleImportBook[],
	selected: string[],
	select: (asins: string[]) => void,
	organizationFor: (book: AudibleImportBook) => SeriesDraft | undefined,
	setOrganization: (asin: string, organization: SeriesDraft | undefined) => void,
	review: (asin: string) => void,
}

const AudibleImportContext = createContext<AudibleImportContextValue | undefined>(undefined)
AudibleImportContext.displayName = "AudibleImportContext"

export default AudibleImportContext
