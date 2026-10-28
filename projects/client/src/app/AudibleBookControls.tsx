import { use } from "react"
import type { AudibleImportBook } from "@books/shared"
import AudibleImportContext from "./context/AudibleImportContext"
import LoggedInAppContext from "./context/LoggedInAppContext"
import AudibleSeriesReview from "./AudibleSeriesReview"
import CheckboxField from "./components/CheckboxField"
import Alert from "./components/Alert"
import Button from "./components/Button"
import Progress from "./Progress"

const AudibleBookControls = ({ book }: { book: AudibleImportBook }) => {
	const controller = use(AudibleImportContext)
	const { token } = use(LoggedInAppContext)
	return (
		<>
			{book.importStatus === "skipped" && <CheckboxField label="Already in Books" checked={true} disabled={true} />}
			{controller?.selecting && book.importStatus === "available" && token.user.isAdmin && controller.selected.includes(book.asin) && book.seriesChoices.length > 0 && (
				<details onInvalidCapture={event => { event.currentTarget.open = true }}>
					<summary>Series organization</summary>
					<AudibleSeriesReview book={book} />
				</details>
			)}
			{(book.importStatus === "queued" || book.importStatus === "downloading") && <Progress percent={book.importStatus === "queued" ? 0 : book.percentage} text={book.importStatus === "queued" ? "Waiting to download" : book.percentage === undefined ? "Downloading…" : `${Math.round(book.percentage)}% · Downloading and preparing`} />}
			{book.importStatus === "failed" && <Alert variant="danger">Could not import. Try again in a new import.</Alert>}
			{book.importStatus === "cancelled" && <p>Download stopped</p>}
			{book.importStatus === "complete" && !book.reviewed && (
				<>
					<p>Imported successfully.</p>
					{!token.user.isAdmin && <Button onClick={() => controller?.review(book.asin)}>Done</Button>}
				</>
			)}
		</>
	)
}

export default AudibleBookControls
