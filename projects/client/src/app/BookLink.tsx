import classnames from "classnames"
import { use, useState } from "react"
import AppContext from "./context/AppContext"
import LoggedInAppContext from "./context/LoggedInAppContext"
import Highlight from "./Highlight"
import { AudibleImportBook, Book, type Status, StatusValues } from "@books/shared"
import { seriesBookTitle, suggestSeriesOrganization } from "@books/shared"
import Api from "./api/LoggedInApi"
import Loading from "./Loading"
import Textbox from "./components/Textbox"
import Edit from "./svg/Edit"
import TextareaAutosize from "react-textarea-autosize"
import itemStyles from "./ItemLink.module.scss"
import styles from "./BookLink.module.scss"
import SeriesFields from "./SeriesFields"
import TextboxField, { type TextboxFieldProps } from "./components/TextboxField"
import Alert from "./components/Alert"
import Button from "./components/Button"
import FolderSelection from "./FolderSelection"
import AudibleImportContext from "./context/AudibleImportContext"
import AudibleBookControls from "./AudibleBookControls"
import CheckboxField from "./components/CheckboxField"
import ActionButtons from "./components/ActionButtons"
import { formatDateTime, handleDynamicImportFailure } from "./shared/Methods"
import DropdownButton from "./components/DropdownButton"

// TODO: Allow normal users to edit books if it's in the Uploads folder
const AdminApi = async () => (await import("./api/AdminApi").catch(handleDynamicImportFailure)).default

function readableDuration(secNum: number) {
	const hours = Math.floor(secNum / 3600)
	const minutes = Math.floor((secNum - (hours * 3600)) / 60)
	const seconds = Math.floor(secNum - (hours * 3600) - (minutes * 60))

	return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}

type EditStatus = "ReadOnly" | "Editing" | "Saving"

interface BookProps {
	book: Book,
	className?: string | undefined,
	style?: React.CSSProperties | undefined,
	onComplete?: () => void,
}

const Inner = ({ children, ...passThroughProps }: React.ComponentProps<"a">) => {
	if (!passThroughProps.href) {
		return (
			<div className={passThroughProps.className}>
				{children}
			</div>
		)
	}
	else {
		return (
			<a {...passThroughProps}>
				{children}
			</a>
		)
	}
}

const EditableTextbox = ({ editing, ...passThroughProps }: EditableTextboxProps) => (
	editing ? <Textbox required={true} {...passThroughProps} /> : <Highlight text={(passThroughProps.value ?? passThroughProps.defaultValue)?.toString() ?? ""} />
)

const EditableTextboxField = ({ editing, ...passThroughProps }: EditableTextboxFieldProps) => {
	if (editing) {
		return <TextboxField required={true} {...passThroughProps} labelLocation="Left" />
	}

	return (
		<label>
			<span>{passThroughProps.label}</span>
			{" "}
			<Highlight text={(passThroughProps.value ?? passThroughProps.defaultValue)?.toString() ?? ""} />
		</label>
	)
}

const BookLink = (props: BookProps) => {
	const { logOut } = use(AppContext)
	const { updateBooks, token, rootDirectory } = use(LoggedInAppContext)
	const controller = use(AudibleImportContext)
	const importBook = props.book instanceof AudibleImportBook ? props.book : undefined
	const book = importBook?.importStatus === "complete" ? rootDirectory.findBookByAsin(importBook.asin) ?? props.book : props.book
	const needsReview = importBook?.importStatus === "complete" && !importBook.reviewed
	const onComplete = needsReview && controller ? () => controller.review(importBook.asin) : props.onComplete
	const selecting = Boolean(controller?.selecting && importBook)
	const selectable = selecting && importBook?.importStatus === "available"
	const selected = Boolean(selectable && controller?.selected.includes(book.asin))
	const toggleSelection = () => {
		if (selectable && controller && !controller.busy) controller.select(selected ? controller.selected.filter(asin => asin !== book.asin) : [...controller.selected, book.asin])
	}
	const [changingStatus, setChangingStatus] = useState(false)
	const [failedCover, setFailedCover] = useState<string>()
	const [editingState, setEditingState] = useState<{ status: EditStatus, alertMessage?: string }>()
	const editStatus = editingState?.status ?? (onComplete && token.user.isAdmin ? "Editing" : "ReadOnly")
	const editing = editStatus !== "ReadOnly"
	const [draftState, setDraftState] = useState<Book>()
	const draft = draftState ?? book
	const updateDraft = (changes: Partial<Book>) => setDraftState(previous => Object.assign(new Book(), previous ?? book, changes))
	const changeBookStatus = async (status: Status, e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation()
		e.preventDefault()

		setChangingStatus(true)

		const ret = await Api.changeBookStatus(book.id, status, logOut)

		updateBooks(ret.directory)
		setChangingStatus(false)
	}
	const handleSubmit = async (event: React.SyntheticEvent<HTMLElement, SubmitEvent>) => {
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form instanceof HTMLFormElement && form.checkValidity()) {
			setEditingState({ status: "Saving" })

			const ret = await (await AdminApi()).updateBook(new Book(draft), logOut)

			if (ret.message) {
				setEditingState({ status: "Editing", alertMessage: ret.message })
				return
			}
			updateBooks(ret.books.directory)
			setEditingState({ status: "ReadOnly" })

			if (onComplete) {
				onComplete()
			}
		}
	}
	const onCancel = () => {
		if (onComplete) {
			onComplete()
		}

		setEditingState({ status: "ReadOnly" })
	}
	const alertMessage = editingState?.alertMessage
	const editClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()
		setDraftState(new Book(book))
		setEditingState({ status: "Editing" })
	}
	const organizeSeries = () => {
		const organization = suggestSeriesOrganization({ name: draft.series, order: draft.seriesOrder }, rootDirectory)
		if (!organization || draft.seriesOrder === undefined) {
			setEditingState({ status: "Editing", alertMessage: "Enter a reading order and choose a series with an unambiguous folder." })
			return
		}
		updateDraft({ name: seriesBookTitle(draft.name, draft.seriesOrder, organization.padding), folderPath: organization.folderPath })
	}
	const changeSeriesOrder = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value === "" ? undefined : event.target.valueAsNumber
		updateDraft({ seriesOrder: value })
		const prefix = /^(\d+)(?:\.\d+)?\s+-\s+/.exec(draft.name)?.[1]
		if (prefix && value !== undefined && event.target.validity.valid) updateDraft({ name: seriesBookTitle(draft.name, value, prefix.startsWith("0") ? prefix.length : 1) })
	}

	const Content = editing ? "form" : "div"

	return (
		<div
			className={classnames(itemStyles.item, { [styles.editing]: editing }, props.className)}
			style={props.style}
			data-selectable={selectable || undefined}
			data-selected={selected || undefined}
			aria-disabled={importBook?.importStatus === "skipped" || undefined}
			onClick={event => {
				event.stopPropagation()
				if (!(event.target instanceof Element)) return
				if (event.target.closest("input, select, textarea, button, a, label, summary")) return
				if (event.currentTarget.querySelector("details")?.contains(event.target)) return
				toggleSelection()
			}}
		>
			<Content onSubmit={e => void handleSubmit(e)}>
				<Inner className={classnames(itemStyles.inner, styles.inner)} href={editing || selecting ? undefined : book.download || undefined}>
					{book.cover && failedCover !== book.cover ? <img className={styles.cover} src={book.cover} alt={`Cover for ${book.name}`} loading="lazy" onError={() => setFailedCover(book.cover)} /> : <div className={classnames(styles.cover, styles.missingCover)}>No cover</div>}
					<div>
						{alertMessage ? <Alert variant="danger">{alertMessage}</Alert> : null}
						<div className={classnames(styles.title, styles.editable)}>
							{selectable ? <CheckboxField label={book.name} checked={selected} disabled={controller?.busy} onChange={toggleSelection} /> : <EditableTextbox editing={editing} value={editing ? draft.name : book.name} placeholder="Title" onChange={e => { updateDraft({ name: e.target.value }) }} />}
							{!editing && !selecting && book.download && token.user.isAdmin && (
								<Edit onClick={editClick} />
							)}
						</div>
						{Boolean(editing || book.comment) && (
							<div className={classnames(styles.description, styles.editable)}>
								{editing ? <TextareaAutosize value={draft.comment} minRows={3} placeholder="Description" required={true} onChange={e => { updateDraft({ comment: e.target.value }) }} /> : <Highlight text={book.comment} />}
							</div>
						)}
						{Boolean(editing || book.author || book.year) && (
							<div className={classnames(styles.author, styles.editable)}>
								<EditableTextboxField editing={editing} label="Author" value={editing ? draft.author : book.author} placeholder="Author" onChange={e => { updateDraft({ author: e.target.value }) }} />
								{Boolean(editing || book.year) && (
									<>
										,&nbsp;
										<EditableTextbox editing={editing} value={editing ? Number.isNaN(draft.year) ? "" : draft.year : book.year} placeholder="Year" type="number" min="1700" max={new Date().getFullYear()} size={4} className={styles.year} onChange={e => { updateDraft({ year: e.target.valueAsNumber }) }} />
									</>
								)}
							</div>
						)}
						{Boolean(editing || book.narrator) && (
							<div className={classnames(styles.narrator, styles.editable)}>
								<EditableTextboxField editing={editing} label="Narrator" value={editing ? draft.narrator : book.narrator} placeholder="Narrator" onChange={e => { updateDraft({ narrator: e.target.value }) }} />
							</div>
						)}
						{Boolean(editing || book.genre) && (
							<div className={classnames(styles.genre, styles.editable)}>
								<EditableTextboxField editing={editing} label="Genre" value={editing ? draft.genre : book.genre} placeholder="Genre" onChange={e => { updateDraft({ genre: e.target.value }) }} />
							</div>
						)}
						{editing ?
								(
									<div className={styles.editable}>
										<SeriesFields
											name={draft.series}
											order={draft.seriesOrder}
											onNameChange={name => {
												updateDraft({ series: name, seriesOrder: name ? draft.seriesOrder : undefined })
											}}
											onOrderChange={changeSeriesOrder}
										/>
										<Button type="button" disabled={!draft.series || draft.seriesOrder === undefined} onClick={event => { if (event.currentTarget.form?.reportValidity()) organizeSeries() }}>Use series folder and reading order</Button>
									</div>
								) :
							book.series ? <p>{`${book.series}${book.seriesOrder !== undefined ? ` · ${book.seriesOrder}` : ""}`}</p> : null}
						{editing && <div className={styles.editable}><FolderSelection value={draft.folderPath} onChange={folderPath => updateDraft({ folderPath })} /></div>}
						{Boolean(book.duration || book.numBytes) && (
							<div className={styles.size}>
								<label>
									<span>Length</span>
									{" "}
									<span>
										{book.duration ? readableDuration(book.duration) : ""}
										{book.duration > 0 && book.numBytes > 0 ? ", " : ""}
										{book.numBytes > 0 && `${Math.round(book.numBytes / 1024 / 1024).toLocaleString()} MB`}
									</span>
								</label>
							</div>
						)}
						{book.uploadTime.getTime() > 0 && (
							<div className={styles.uploadTime}>
								<label>
									<span>Uploaded</span>
									{" "}
									<span>{formatDateTime(book.uploadTime)}</span>
								</label>
							</div>
						)}
						{editing && (
							<ActionButtons actionButtonText="Save" onCancelClick={onCancel} changeHappening={editStatus === "Saving"} changeHappeningText="Saving..." />
						)}
					</div>
				</Inner>
				{importBook && <AudibleBookControls book={importBook} />}
			</Content>
			{book.download && !selecting && !changingStatus && !editing && (
				<DropdownButton
					title={book.status}
					id={book.id}
					onClick={e => e.stopPropagation()}
					onSelect={(status, e) => void changeBookStatus(status, e)}
					options={StatusValues.filter(status => status !== book.status).map(status => ({ label: `Mark ${status}`, value: status }))}

				/>
			)}
			{changingStatus && !editing && <Loading text="Changing Status..." />}
		</div>
	)
}

interface EditableTextboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
	editing: boolean,
}

interface EditableTextboxFieldProps extends TextboxFieldProps {
	editing: boolean,
}

BookLink.displayName = "BookLink"

export default BookLink
