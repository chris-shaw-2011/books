import { use, useMemo, useState } from "react"
import { audibleBooks, suggestSeriesOrganization, type AudibleImportBook, type AudibleImportSnapshot, type SeriesOrganization } from "@books/shared"
import ItemListTabContent from "./ItemListTabContent"
import styles from "./AudibleBookList.module.scss"
import LoggedInAppContext from "./context/LoggedInAppContext"
import AudibleImportContext, { type SeriesDraft } from "./context/AudibleImportContext"
import CheckboxField from "./components/CheckboxField"
import { filterImportedBooks } from "./AudibleImportItems"

interface Props {
	snapshot: AudibleImportSnapshot,
	busy: boolean,
	onSelect: (asins: string[], organizations: Record<string, SeriesOrganization>) => void,
	onReview: (asin: string) => void,
}

const AudibleBookList = ({ snapshot, busy, onSelect, onReview }: Props) => {
	const { rootDirectory, token } = use(LoggedInAppContext)
	const [selected, setSelected] = useState<string[]>([])
	const [showImported, setShowImported] = useState(false)
	const [organizationEdits, setOrganizationEdits] = useState<Record<string, SeriesDraft | undefined>>({})
	const controller = useMemo(() => {
		const available = audibleBooks(snapshot.books).filter(book => book.importStatus === "available")
		return {
			selecting: snapshot.phase === "selecting",
			busy,
			available,
			selected: available.filter(book => selected.includes(book.asin)).map(book => book.asin),
			select: setSelected,
			organizationFor: (book: AudibleImportBook) => {
				if (Object.hasOwn(organizationEdits, book.asin)) return organizationEdits[book.asin]
				const series = book.seriesChoices.length === 1 ? book.seriesChoices[0] : undefined
				return series && suggestSeriesOrganization(series, rootDirectory)
			},
			setOrganization: (asin: string, organization: SeriesDraft | undefined) => setOrganizationEdits(previous => ({ ...previous, [asin]: organization })),
			review: onReview,
		}
	}, [snapshot, busy, selected, organizationEdits, rootDirectory, onReview])
	const { selecting, available, selected: selection, organizationFor } = controller
	const items = useMemo(() => {
		const visible = showImported ? snapshot.books : filterImportedBooks(snapshot.books)
		return selecting ? visible : audibleBooks(visible).filter(book => book.importStatus !== "available")
	}, [snapshot.books, selecting, showImported])
	const Content = selecting ? "form" : "div"

	return (
		<AudibleImportContext value={controller}>
			<section aria-label="Audible books" className={selecting ? styles.selection : undefined}>
				<Content onSubmit={event => {
					if (!selecting) return
					event.preventDefault()
					const organizations: Record<string, SeriesOrganization> = {}
					if (token.user.isAdmin) {
						for (const book of available.filter(book => selection.includes(book.asin))) {
							const proposal = organizationFor(book)
							if (proposal?.series.order !== undefined) organizations[book.asin] = { ...proposal, series: { ...proposal.series, order: proposal.series.order } }
						}
					}
					onSelect(selection, organizations)
				}}
				>
					{selecting && (
						<p>
							{token.user.isAdmin ? "Review series details before downloading. " : ""}
							Your connection expires in 30 minutes.
						</p>
					)}
					{selecting && available.length === 0 && <p>No new books are available to import.</p>}
					<ItemListTabContent
						items={items}
						toolbarControls={<CheckboxField label="Show already imported" checked={showImported} onChange={event => setShowImported(event.target.checked)} />}
					/>
				</Content>
			</section>
		</AudibleImportContext>
	)
}

export default AudibleBookList
