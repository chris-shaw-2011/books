import classnames from "classnames"
import { use } from "react"
import { Directory } from "@books/shared"
import FolderClosed from "./svg/FolderClosed"
import FolderOpen from "./svg/FolderOpen"
import Highlight from "./Highlight"
import ItemLink from "./ItemLink"
import itemStyles from "./ItemLink.module.scss"
import SearchContext from "./context/AppContext"
import AudibleImportContext from "./context/AudibleImportContext"
import { create } from "zustand"
import styles from "./DirectoryLink.module.scss"

interface DirectoryProps {
	directory: Directory,
	className?: string | undefined,
	style?: React.CSSProperties | undefined,
}

interface FolderStore {
	openFolders: Record<string, boolean>,
	setOpen: (path: string, open: boolean) => void,
}

const useFolderStore = create<FolderStore>(set => ({
	openFolders: {},
	setOpen: (id, open) => {
		set(state => state.openFolders[id] === open ? state : { openFolders: { ...state.openFolders, [id]: open } })
	},
}))

const DirectoryLink = (props: DirectoryProps) => {
	const id = props.directory.id
	const controller = use(AudibleImportContext)
	const searchContext = use(SearchContext)
	const searchWords = searchContext.searchWords
	const isOpen = useFolderStore(state => searchWords.length > 0 || (state.openFolders[id] ?? Boolean(controller?.selecting)))
	const setOpen = useFolderStore(state => state.setOpen)

	return (
		<details
			style={props.style}
			className={classnames(styles.directory, props.className)}
			open={isOpen}
			onInvalidCapture={event => {
				event.currentTarget.open = true
				setOpen(id, true)
			}}
			onToggle={event => { if (event.target === event.currentTarget) setOpen(id, event.currentTarget.open) }}
		>
			<summary className={classnames(styles.inner, itemStyles.inner)}>
				{isOpen ? <FolderOpen /> : <FolderClosed />}
				<Highlight text={props.directory.name} />
			</summary>
			{(isOpen || controller?.selecting) && props.directory.items.map(item => <ItemLink key={item.id} item={item} style={props.style} className={props.className} />)}
		</details>
	)
}

DirectoryLink.displayName = "DirectoryLink"

export default DirectoryLink
