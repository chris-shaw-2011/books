import { use, useState } from "react"
import classnames from "classnames"
import type { AudibleImportBook, AudibleImportSnapshot, Book, Directory } from "@books/shared"
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
	onSelect: (asins: string[]) => void,
	onReview: (asin: string) => void,
}

const AudibleBookList = ({ snapshot, busy, onSelect, onReview }: Props) => {
	const [selected, setSelected] = useState<string[]>([])
	const selecting = snapshot.phase === "selecting"
	const available = snapshot.books.filter(book => book.status === "available")
	const selection = available.filter(book => selected.includes(book.asin)).map(book => book.asin)
	const allSelected = available.length > 0 && selection.length === available.length
	const books = snapshot.books.filter(entry => selecting || entry.status !== "available")
		.sort((first, second) => Number(first.status === "skipped") - Number(second.status === "skipped"))

	return (
		<section aria-label="Audible books">
			{selecting && (
				<div className={styles.selectionControls}>
					<p>Choose the books you want to add. Nothing downloads until you confirm your selection.</p>
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
									<Button className={styles.primary} disabled={busy || selection.length === 0} onClick={() => onSelect(selection)}>
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
		</section>
	)
}

export default AudibleBookList
