import { use } from "react"
import LoggedInAppContext from "./context/LoggedInAppContext"
import { suggestSeriesOrganization, seriesBookTitle, type AudibleImportBook, type BookSeries, type SeriesOrganization } from "@books/shared"
import TextboxField from "./components/TextboxField"
import styles from "./AudibleImport.module.scss"

export type SeriesDraft = Omit<SeriesOrganization, "series"> & { series: BookSeries }

interface Props {
	book: AudibleImportBook,
	organization: SeriesDraft | undefined,
	disabled: boolean,
	onChange: (value: SeriesDraft | undefined) => void,
}

const AudibleSeriesReview = ({ book, organization, disabled, onChange }: Props) => {
	const { rootDirectory } = use(LoggedInAppContext)
	const chooseSeries = (name: string) => {
		const series = book.series?.find(series => series.name === name)
		onChange(series ? suggestSeriesOrganization(series, rootDirectory) ?? { series, folderPath: "", padding: 2 } : undefined)
	}
	return (
		<div className={styles.seriesReview}>
			<label>
				Series organization
				<select
					aria-label={`Series for ${book.title}`}
					disabled={disabled}
					value={organization?.series.name ?? ""}
					onChange={event => chooseSeries(event.target.value)}
				>
					<option value="">Keep in Upload</option>
					{book.series?.map(series => <option key={series.name} value={series.name}>{series.name}</option>)}
				</select>
			</label>
			{organization ?
					(
						<>
							<TextboxField label="Series folder" required={true} value={organization.folderPath} disabled={disabled} onChange={event => onChange({ ...organization, folderPath: event.target.value })} />
							<TextboxField label="Reading order" value={organization.series.order ?? ""} type="number" min={0} step="any" required={true} disabled={disabled} onChange={event => onChange({ ...organization, series: { ...organization.series, order: event.target.value === "" ? undefined : event.target.valueAsNumber } })} />
							{organization.series.order !== undefined ? <p className={styles.hint}>{`${organization.folderPath}/${seriesBookTitle(book.title, organization.series.order, organization.padding)}.m4b`}</p> : <p role="alert">Enter a reading order, such as 1 or 2.5.</p>}
						</>
					) :
					<p className={styles.hint}>{(book.series?.length ?? 0) > 1 ? "This book belongs to multiple series. Choose one to organize it." : "Choose the series to review its folder and reading order, or leave this book in Upload."}</p>}
		</div>
	)
}

export default AudibleSeriesReview
