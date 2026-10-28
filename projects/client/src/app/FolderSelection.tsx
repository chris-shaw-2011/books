import classnames from "classnames"
import { use, useEffect, useRef, useState } from "react"
import type { Directory } from "@books/shared"
import AppContext from "./context/AppContext"
import LoggedInAppContext from "./context/LoggedInAppContext"
import FolderOpen from "./svg/FolderOpen"
import FolderClosed from "./svg/FolderClosed"
import Textbox from "./components/Textbox"
import Button from "./components/Button"
import ActionButtons from "./components/ActionButtons"
import { handleDynamicImportFailure } from "./shared/Methods"
import styles from "./FolderSelection.module.scss"
import { itemOrders } from "./ItemOrder"

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
	const subDirs = directory.items.filter((i): i is Directory => i.type === "Directory").toSorted(itemOrders["Alphabetically - Ascending"])
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
			{open && (subDirs.length > 0 || addingFolder) && (
				<div className={styles.subFolderList}>
					{addingFolder && (
						<div className={styles.newFolder}>
							<FolderClosed className={styles.folder} />
							<Textbox autoFocus={true} placeholder="New Folder Name" onChange={e => props.setNewFolderName(e.target.value)} value={newFolderName} />
						</div>
					)}
					{subDirs.map(i => <FolderList key={i.id} {...props} directory={i} className="" />)}
				</div>
			)}
		</div>
	)
}

interface FolderSelectionProps {
	value: string,
	onChange: (folderPath: string) => void,
}

type FolderStatus = "None" | "Adding" | "Saving"

interface FolderState {
	newFolderName: string,
	status: FolderStatus,
}

const defaultNewFolderState: FolderState = { newFolderName: "", status: "None" }

const FolderSelection = ({ value, onChange }: FolderSelectionProps) => {
	const { rootDirectory, updateBooks } = use(LoggedInAppContext)
	const { logOut } = use(AppContext)
	const [open, setOpen] = useState(false)
	const listRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (open) listRef.current?.getElementsByClassName(styles.selected)[0]?.scrollIntoView({ behavior: "auto", block: "nearest" })
	}, [open])
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

		const api = (await import("./api/AdminApi").catch(handleDynamicImportFailure)).default
		const result = await api.addFolder(value, newFolderName, logOut)
		updateBooks(result.directory)
		onChange(`${value}${!value.endsWith("/") ? "/" : ""}${newFolderName}`)
		setNewFolderState(defaultNewFolderState)
	}
	const status = newFolderState.status

	return (
		<div className={styles.path}>
			<label onClick={() => setOpen(previous => !previous)}>
				<span>Path</span>
				<span>
					{open ? <FolderOpen className={styles.folder} /> : <FolderClosed className={styles.folder} />}
					<span>{value}</span>
				</span>
			</label>
			{open && (
				<div className={styles.pathSelection}>
					<span>&nbsp;</span>
					<div ref={listRef}>
						<FolderList directory={rootDirectory} selectedFolder={value} folderClicked={onChange} className={styles.folderList} newFolderName={status !== "None" ? newFolderState.newFolderName : undefined} setNewFolderName={setNewFolderName} />
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
				</div>
			)}
		</div>
	)
}

export default FolderSelection
