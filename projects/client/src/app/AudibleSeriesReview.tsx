import { use } from "react"
import LoggedInAppContext from "./context/LoggedInAppContext"
import AudibleImportContext, { type SeriesDraft } from "./context/AudibleImportContext"
import { suggestSeriesOrganization, seriesBookTitle, type AudibleImportBook } from "@books/shared"
import TextboxField from "./components/TextboxField"
import SeriesFields from "./SeriesFields"

const AudibleSeriesReview = ({ book }: { book: AudibleImportBook }) => {
	const { rootDirectory } = use(LoggedInAppContext)
	const controller = use(AudibleImportContext)
	if (!controller) return null
	const organization = controller.organizationFor(book)
	const disabled = controller.busy
	const onChange = (value: SeriesDraft | undefined) => controller.setOrganization(book.asin, value)
	const chooseSeries = (name: string) => {
		const series = book.seriesChoices.find(series => series.name === name)
		onChange(series ? suggestSeriesOrganization(series, rootDirectory) ?? { series, folderPath: "", padding: 2 } : undefined)
	}

	return (
		<div>
			<SeriesFields
				name={organization?.series.name ?? ""}
				order={organization?.series.order}
				onNameChange={chooseSeries}
				onOrderChange={event => { if (organization) onChange({ ...organization, series: { ...organization.series, order: event.target.value === "" ? undefined : event.target.valueAsNumber } }) }}
				options={[{ value: "", label: "Keep in Upload" }, ...book.seriesChoices.map(series => ({ value: series.name, label: series.name }))]}
				required={true}
				disabled={disabled}
			/>
			{organization && (
				<>
					<TextboxField label="Path" labelLocation="Left" required={true} value={organization.folderPath} disabled={disabled} onChange={event => onChange({ ...organization, folderPath: event.target.value })} />
					{organization.series.order !== undefined && <p>{`${organization.folderPath}/${seriesBookTitle(book.name, organization.series.order, organization.padding)}.m4b`}</p>}
				</>
			)}
			{!organization && book.seriesChoices.length > 1 && <p>This book belongs to multiple series. Choose one to organize it.</p>}
		</div>
	)
}

export default AudibleSeriesReview
