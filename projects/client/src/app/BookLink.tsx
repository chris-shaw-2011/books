import classnames from "classnames"
import { useContext, useState, useEffect } from "react"
import AppContext from "./context/AppContext"
import LoggedInAppContext from "./context/LoggedInAppContext"
import { Dropdown, DropdownButton } from "react-bootstrap"
import Highlighter from "react-highlight-words"
import { Book, type Status, Directory, StatusValues } from "@books/shared"
import Api from "./api/LoggedInApi"
import Loading from "./Loading"
import Textbox from "./components/Textbox"
import Edit from "./svg/Edit"
import TextareaAutosize from "react-textarea-autosize"
import itemStyles from "./ItemLink.module.scss"
import styles from "./BookLink.module.scss"
import TextboxField, { type TextboxFieldProps } from "./components/TextboxField"
import Alert from "./components/Alert"
import FolderOpen from "./svg/FolderOpen"
import FolderClosed from "./svg/FolderClosed"
import Button from "./components/Button"
import SearchContext from "./context/AppContext"
import ActionButtons from "./components/ActionButtons"
import { formatDateTime, handleDynamicImportFailure } from "./shared/Methods"

// TODO: Allow normal users to edit books if it's in the Uploads folder
const AdminApi = async () => (await import("./api/AdminApi").catch(handleDynamicImportFailure)).default

const sanitize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

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
	editOnly?: boolean,
	onEditComplete?: () => void,
}

const Inner = ({ editing, children, ...passThroughProps }: InnerProps) => {
	if (editing) {
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

const EditableTextbox = ({ editing, searchWords, ...passThroughProps }: EditableTextboxProps) => (
	editing ? <Textbox required={true} {...passThroughProps} /> : <Highlighter searchWords={[...searchWords]} textToHighlight={passThroughProps.defaultValue?.toString() ?? ""} sanitize={sanitize} />
)

const EditableTextboxField = ({ editing, searchWords, ...passThroughProps }: EditableTextboxFieldProps) => {
	if (editing) {
		return <TextboxField required={true} {...passThroughProps} labelLocation="Left" />
	}

	return (
		<label>
			<span>{passThroughProps.label}</span>
			{" "}
			<Highlighter searchWords={[...searchWords]} textToHighlight={passThroughProps.defaultValue?.toString() ?? ""} sanitize={sanitize} />
		</label>
	)
}

interface FolderListProps {
	directory: Directory,
	selectedFolder: string,
	folderClicked: (folderPath: string) => void,
	className?: string,
	newFolderName?: string | undefined,
	setNewFolderName: (name: string) => void,
}

const FolderList = (props: FolderListProps) => {
	const { directory, selectedFolder, newFolderName } = { ...props }
	const open = selectedFolder.startsWith(directory.folderPath)
	const subDirs = directory.items.filter((i): i is Directory => i.type === "Directory")
	const addingFolder = open && newFolderName !== undefined && directory.folderPath === selectedFolder

	return (
		<div className={props.className}>
			<div
				className={classnames({ [styles.selected]: selectedFolder === directory.folderPath }, styles.selectableFolder)}
				onClick={e => {
					e.stopPropagation()
					props.folderClicked(directory.folderPath)
				}}
			>
				{open ? <FolderOpen className={styles.folder} /> : <FolderClosed className={styles.folder} />}
				{directory.name || directory.folderPath}
			</div>
			{open && (subDirs.length || addingFolder) && (
				<div className={styles.subFolderList}>
					{addingFolder && (
						<div className={styles.newFolder}>
							<FolderClosed className={styles.folder} />
							<Textbox autoFocus={true} placeholder="New Folder Name" onChange={e => props.setNewFolderName(e.target.value)} value={newFolderName} />
						</div>
					)}
					{subDirs.map(i => <FolderList {...props} key={i.id} directory={i} className="" />)}
				</div>
			)}
		</div>
	)
}

interface FolderSelectionProps extends Omit<FolderListProps, "newFolderName" | "setNewFolderName"> {
	addNewFolder: (path: string, folderName: string) => Promise<void>,
}

type FolderStatus = "None" | "Adding" | "Saving"

interface FolderState {
	newFolderName: string,
	status: FolderStatus,
}

const defaultNewFolderState: FolderState = { newFolderName: "", status: "None" }

const FolderSelection = (props: FolderSelectionProps) => {
	const [newFolderState, setNewFolderState] = useState(defaultNewFolderState)
	const mergeNewFolderState = (obj: Partial<FolderState>) => {
		setNewFolderState(s => ({ ...s, ...obj }))
	}
	const setNewFolderName = (name: string) => {
		mergeNewFolderState({ newFolderName: name })
	}
	const addNewFolder = async () => {
		const newFolderName = newFolderState.newFolderName

		mergeNewFolderState({ status: "Saving" })

		await props.addNewFolder(props.selectedFolder, newFolderName)
		props.folderClicked(`${props.selectedFolder}${!props.selectedFolder.endsWith("/") ? "/" : ""}${newFolderName}`)
		setNewFolderState(defaultNewFolderState)
	}
	const status = newFolderState.status

	return (
		<div>
			<FolderList {...props} className={styles.folderList} newFolderName={status !== "None" ? newFolderState.newFolderName : undefined} setNewFolderName={setNewFolderName} />
			{status !== "None" && (
				<ActionButtons
					cancelButtonClassName={styles.newFolderButton}
					actionButtonClassName={styles.newFolderButton}
					onCancelClick={() => setNewFolderState(defaultNewFolderState)}
					actionButtonText="Create Folder"
					actionButtonDisabled={!newFolderState.newFolderName}
					actionButtonOnClick={() => void addNewFolder()}
					changeHappening={status === "Saving"}
					changeHappeningText="Creating folder..."
					className={styles.actionButtons}
				/>
			)}
			{status === "None" && (
				<Button type="button" className={styles.newFolderButton} onClick={() => mergeNewFolderState({ status: "Adding" })}>
					<FolderOpen className={styles.folder} />
					{" "}
					New Folder
				</Button>
			)}
		</div>
	)
}

const BookLink = (props: BookProps) => {
	const { logOut } = useContext(AppContext)
	const { updateBooks, token, rootDirectory } = useContext(LoggedInAppContext)
	const searchContext = useContext(SearchContext)
	const [changingStatus, setChangingStatus] = useState(false)
	const [editingState, setEditingState] = useState<{ status: EditStatus, alertMessage?: string }>({ status: props.editOnly ? "Editing" : "ReadOnly" })
	const editing = editingState.status === "Editing" || editingState.status === "Saving"
	const [newTitle, setNewTitle] = useState(props.book.name)
	const [newDescription, setNewDescription] = useState(props.book.comment)
	const [newAuthor, setNewAuthor] = useState(props.book.author)
	const [newYear, setNewYear] = useState(props.book.year)
	const [newNarrator, setNewNarrator] = useState(props.book.narrator)
	const [newGenre, setNewGenre] = useState(props.book.genre)
	const [showPathOptions, setShowPathOptions] = useState(false)
	const [newPath, setNewPath] = useState<undefined | string>()
	const changeBookStatus = async (status: Status, e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation()
		e.preventDefault()

		setChangingStatus(true)

		const ret = await Api.changeBookStatus(props.book.id, status, logOut)

		updateBooks(ret.directory)
	}
	const bookClicked = (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.stopPropagation()

		if (editing) {
			e.preventDefault()
		}
	}
	const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form.checkValidity()) {
			const newBook = new Book(props.book)

			newBook.genre = newGenre
			newBook.name = newTitle
			newBook.year = newYear
			newBook.comment = newDescription
			newBook.author = newAuthor
			newBook.narrator = newNarrator
			newBook.folderPath = newPath ?? props.book.folderPath

			setEditingState({ status: "Saving" })

			const ret = await (await AdminApi()).updateBook(newBook, props.book, logOut)

			updateBooks(ret.books.directory)
			setEditingState({ status: "ReadOnly" })

			if (props.onEditComplete) {
				props.onEditComplete()
			}
		}
	}
	const onCancel = () => {
		if (props.onEditComplete) {
			props.onEditComplete()
		}

		setEditingState({ status: "ReadOnly" })
	}
	const alertMessage = editingState.alertMessage
	const addNewFolder = async (path: string, folderName: string) => {
		const ret = await (await AdminApi()).addFolder(path, folderName, logOut)

		updateBooks(ret.directory)
	}
	const searchWords = searchContext.searchWords
	const editClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()
		setEditingState({ status: "Editing" })
	}

	useEffect(() => {
		if (showPathOptions) {
			document.getElementsByClassName(styles.folderList)[0]?.getElementsByClassName(styles.selected)[0]?.scrollIntoView({ behavior: "auto", block: "nearest" })
		}
	}, [showPathOptions])

	return (
		<div className={classnames({ [styles.editing]: editing }, props.className)} style={props.style} onClick={e => { e.stopPropagation() }}>
			<form onSubmit={e => void handleSubmit(e)}>
				<Inner className={classnames(itemStyles.inner, styles.inner)} href={props.book.download} onClick={bookClicked} editing={editing}>
					<img src={props.book.cover} alt="cover" />
					<div>
						{alertMessage ? <Alert variant="danger">{alertMessage}</Alert> : null}
						<div className={classnames(styles.title, styles.editable)}>
							<EditableTextbox editing={editing} defaultValue={props.book.name} placeholder="Title" onChange={e => { setNewTitle(e.target.value) }} searchWords={searchWords} />
							{!editing && token.user.isAdmin && (
								<Edit onClick={editClick} />
							)}
						</div>
						<div className={classnames(styles.description, styles.editable)}>
							{editing ? <TextareaAutosize defaultValue={props.book.comment} minRows={3} placeholder="Description" required={true} onChange={e => { setNewDescription(e.target.value) }} /> : <Highlighter searchWords={[...searchWords]} textToHighlight={props.book.comment} sanitize={sanitize} />}
						</div>
						<div className={classnames(styles.author, styles.editable)}>
							<EditableTextboxField editing={editing} label="Author" defaultValue={props.book.author} placeholder="Author" onChange={e => { setNewAuthor(e.target.value) }} searchWords={searchWords} />
							,&nbsp;
							<EditableTextbox editing={editing} defaultValue={props.book.year} placeholder="Year" type="number" min="1700" max={new Date().getFullYear()} size={4} className={styles.year} onChange={e => { setNewYear(parseInt(e.target.value, 10)) }} searchWords={searchWords} />
						</div>
						<div className={classnames(styles.narrator, styles.editable)}>
							<EditableTextboxField editing={editing} label="Narrator" defaultValue={props.book.narrator} placeholder="Narrator" onChange={e => { setNewNarrator(e.target.value) }} searchWords={searchWords} />
						</div>
						<div className={classnames(styles.genre, styles.editable)}>
							<EditableTextboxField editing={editing} label="Genre" defaultValue={props.book.genre} placeholder="Genre" onChange={e => { setNewGenre(e.target.value) }} searchWords={searchWords} />
						</div>
						{editing && (
							<div className={classnames(styles.path, styles.editable)}>
								<label onClick={() => { setShowPathOptions(p => !p) }}>
									<span>Path</span>
									<span>
										{!showPathOptions ? <FolderClosed className={styles.folder} /> : <FolderOpen className={styles.folder} />}
										<span>{newPath ?? props.book.folderPath}</span>
									</span>
								</label>
								{showPathOptions && (
									<div className={styles.pathSelection}>
										<span>&nbsp;</span>
										<FolderSelection directory={rootDirectory} selectedFolder={newPath ?? props.book.folderPath} folderClicked={setNewPath} addNewFolder={addNewFolder} />
									</div>
								)}
							</div>
						)}
						<div className={styles.size}>
							<label>
								<span>Length</span>
								{" "}
								<span>
									{props.book.duration ? `${readableDuration(props.book.duration)}, ` : ""}
									{Math.round(props.book.numBytes / 1024 / 1024).toLocaleString()}
									{" "}
									MB
								</span>
							</label>
						</div>
						<div className={styles.uploadTime}>
							<label>
								<span>Uploaded</span>
								{" "}
								<span>{formatDateTime(props.book.uploadTime)}</span>
							</label>
						</div>
						{(editingState.status === "Saving" || editingState.status == "Editing") && (
							<ActionButtons actionButtonText="Save" onCancelClick={onCancel} changeHappening={editingState.status === "Saving"} changeHappeningText="Saving..." />
						)}
					</div>
				</Inner>
			</form>
			{!changingStatus && !editing && (
				<DropdownButton title={props.book.status} id={props.book.id} onClick={e => e.stopPropagation()}>
					{
						StatusValues.map(i => {
							if (i !== props.book.status) {
								return (
									<Dropdown.Item key={i} onClick={e => void changeBookStatus(i, e)}>
										Mark
										{" "}
										{i}
									</Dropdown.Item>
								)
							}

							return undefined
						})
					}
				</DropdownButton>
			)}
			{changingStatus && !editing && <Loading text="Changing Status..." />}
		</div>
	)
}

interface InnerProps extends React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> {
	editing: boolean,
}

interface EditableTextboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
	editing: boolean,
	searchWords: readonly string[],
}

interface EditableTextboxFieldProps extends TextboxFieldProps {
	editing: boolean,
	searchWords: readonly string[],
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

BookLink.displayName = "BookLink"

export default BookLink
