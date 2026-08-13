import classnames from "classnames"
import { useContext } from "react"
import { Directory, Book } from "@books/shared"
import FolderClosed from "./svg/FolderClosed"
import FolderOpen from "./svg/FolderOpen"
import Highlighter from "react-highlight-words"
import ItemLink from "./ItemLink"
import itemStyles from "./ItemLink.module.scss"
import SearchContext from "./context/AppContext"
import { create } from "zustand"
import styles from "./DirectoryLink.module.scss"

interface DirectoryProps {
	directory: Directory,
	className?: string | undefined,
	style?: React.CSSProperties | undefined,
}

interface ChildItemProps {
	items: (Directory | Book)[],
	className?: string | undefined,
	style?: React.CSSProperties | undefined,
}

interface FolderStore {
	openFolders: Record<string, boolean>,
	toggleFolder: (e: React.MouseEvent, path: string) => void,
}

const useFolderStore = create<FolderStore>(set => ({
	openFolders: {},
	toggleFolder: (e, id) => {
		e.stopPropagation()
		set(state => ({
			openFolders: { ...state.openFolders, [id]: !state.openFolders[id] },
		}))
	},
}))

const ChildItems = (props: ChildItemProps) => (
	<>
		{props.items.map(item => <ItemLink className={props.className} style={props.style} item={item} key={item.id} />)}
	</>
)

const DirectoryLink = (props: DirectoryProps) => {
	const id = props.directory.id
	const searchContext = useContext(SearchContext)
	const searchWords = searchContext.searchWords
	const isOpen = useFolderStore(state => (searchWords.length || state.openFolders[id]) ?? false)
	const toggleFolder = useFolderStore(state => state.toggleFolder)

	return (
		<div style={props.style} className={classnames(styles.directory, props.className)} onClick={e => toggleFolder(e, id)}>
			<div className={classnames(styles.inner, itemStyles.inner)}>
				{isOpen ? <FolderOpen /> : <FolderClosed />}
				<Highlighter searchWords={[...searchWords]} textToHighlight={props.directory.name} />
			</div>
			<ChildItems items={isOpen ? props.directory.items : []} style={props.style} className={props.className} />
		</div>
	)
}

DirectoryLink.displayName = "DirectoryLink"

export default DirectoryLink
