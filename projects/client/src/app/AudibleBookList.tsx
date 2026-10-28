import { use, useState } from "react"
import classnames from "classnames"
import type { AudibleImportBook, AudibleImportSnapshot, Book, Directory } from "@books/shared"
import { suggestSeriesOrganization, type SeriesOrganization } from "@books/shared"
import AudibleSeriesReview, { type SeriesDraft } from "./AudibleSeriesReview"
import BookLink from "./BookLink"
import CompletedBook from "./CompletedBook"
import Button from "./components/Button"
import LoggedInAppContext from "./context/LoggedInAppContext"
import styles from "./AudibleImport.module.scss"

const findImportedBook = (directory: Directory, imported: Book): Book | undefined => {
	for (const item of directory.items) {
		if (item.type === "Book") {
			if (item.id === imported.id || item.asin === imported.asin) return item
		}
		else {
			const found = findImportedBook(item, imported)
			if (found) return found
		}
	}
}

const ImportedBook = ({ entry, onReview }: { entry: AudibleImportBook & { book: Book }, onReview: () => void }) => {
	const { rootDirectory } = use(LoggedInAppContext)
	const book = findImportedBook(rootDirectory, entry.book) ?? entry.book

	return (
		<div className={styles.completed}>
			{entry.reviewed ? <BookLink book={book} /> : <CompletedBook book={book} onComplete={onReview} />}
		</div>
	)
}

interface Props {
	snapshot: AudibleImportSnapshot,
	busy: boolean,
	onSelect: (asins: string[], organizations: Record<string, SeriesOrganization>) => void,
	onReview: (asin: string) => void,
}

const AudibleBookList = ({ snapshot, busy, onSelect, onReview }: Props) => {
	const { rootDirectory, token } = use(LoggedInAppContext)
	const [selected, setSelected] = useState<string[]>([])
	const [organizationEdits, setOrganizationEdits] = useState<Record<string, SeriesDraft | undefined>>({})
	const organizationFor = (book: AudibleImportBook) => {
		if (Object.hasOwn(organizationEdits, book.asin)) return organizationEdits[book.asin]
		const series = book.series?.length === 1 ? book.series[0] : undefined
		return series && suggestSeriesOrganization(series, rootDirectory)
	}
	const selecting = snapshot.phase === "selecting"
	const available = snapshot.books.filter(book => book.status === "available")
	const selection = available.filter(book => selected.includes(book.asin)).map(book => book.asin)
	const organizations: Record<string, SeriesOrganization> = {}
	if (token.user.isAdmin) {
		for (const book of available.filter(book => selection.includes(book.asin))) {
			const proposal = organizationFor(book)
			if (proposal?.series.order !== undefined) organizations[book.asin] = { ...proposal, series: { ...proposal.series, order: proposal.series.order } }
		}
	}
	const allSelected = available.length > 0 && selection.length === available.length
	const books = snapshot.books.filter(entry => selecting || entry.status !== "available")
		.sort((first, second) => Number(first.status === "skipped") - Number(second.status === "skipped"))

	const Content = selecting ? "form" : "div"

	return (
		<section aria-label="Audible books">
			<Content onSubmit={event => {
				if (selecting) {
					event.preventDefault()
					onSelect(selection, organizations)
				}
			}}
			>
				{selecting && (
					<div className={styles.selectionControls}>
						<p>Choose the books you want to add. Nothing downloads until you confirm your selection.</p>
						{token.user.isAdmin && <p>Series books will use the folders and reading orders shown below. Review these before starting downloads. Books without series information stay in Upload.</p>}
						<p className={styles.hint}>Your Audible connection expires after 30 minutes while you choose.</p>
						{available.length > 0 ?
								(
									<>
										<label className={styles.bookChoice}>
											<input
												type="checkbox"
												checked={allSelected}
												ref={input => { if (input) input.indeterminate = selection.length > 0 && !allSelected }}
												disabled={busy}
												onChange={event => setSelected(event.target.checked ? available.map(book => book.asin) : [])}
											/>
											Select all available books
										</label>
										<p role="status">{`${selection.length} of ${available.length} selected`}</p>
										<Button className={styles.primary} type="submit" disabled={busy || selection.length === 0}>
											{busy ? "Starting downloads…" : `Download ${selection.length} selected ${selection.length === 1 ? "book" : "books"}`}
										</Button>
									</>
								) :
								<p>No new books are available to import. You can stop this import and close the window.</p>}
					</div>
				)}
				<ul className={styles.bookList}>
					{books.map(entry => (
						<li key={entry.asin} className={classnames(styles.bookRow, { [styles.previouslyImported]: entry.status === "skipped" })}>
							{entry.book ?
									<ImportedBook entry={{ ...entry, book: entry.book }} onReview={() => onReview(entry.asin)} /> :
									(
										<>
											<label className={styles.bookChoice}>
												{entry.status === "skipped" && <span className={styles.importedIndicator} role="img" aria-label="Already imported" title="Already imported">✓</span>}
												{selecting && entry.status !== "skipped" && (
													<input
														type="checkbox"
														checked={selection.includes(entry.asin)}
														disabled={busy || entry.status !== "available"}
														onChange={event => setSelected(previous => event.target.checked ? [...previous, entry.asin] : previous.filter(asin => asin !== entry.asin))}
													/>
												)}
												{entry.coverUrl ? <img className={styles.cover} src={entry.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true }} /> : <span className={styles.coverPlaceholder} aria-hidden="true">No cover</span>}
												<span className={styles.bookTitle}>{entry.title}</span>
											</label>
											{Boolean(entry.series?.length) && <p className={styles.hint}>{entry.series?.map(series => series.name).join("; ")}</p>}
											{selecting && token.user.isAdmin && selection.includes(entry.asin) && Boolean(entry.series?.length) && (
												<AudibleSeriesReview book={entry} organization={organizationFor(entry)} disabled={busy} onChange={value => setOrganizationEdits(previous => ({ ...previous, [entry.asin]: value }))} />
											)}
											{entry.status !== "available" && entry.status !== "skipped" && (
												<p className={styles.bookStatus} role="status">
													{({ queued: "Waiting to download", downloading: entry.percentage === undefined ? "Downloading…" : `${Math.round(entry.percentage)}% · Downloading and preparing`, complete: "Imported successfully", failed: "Could not import. Try again in a new import.", cancelled: "Download stopped" })[entry.status]}
												</p>
											)}
											{(entry.status === "queued" || entry.status === "downloading") && (
												<progress className={styles.bookProgress} aria-label={`Download progress for ${entry.title}`} max={100} value={entry.status === "queued" ? 0 : entry.percentage} />
											)}
										</>
									)}
						</li>
					))}
				</ul>
			</Content>
		</section>
	)
}

export default AudibleBookList
