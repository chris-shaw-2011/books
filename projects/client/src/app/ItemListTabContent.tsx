import { useState } from "react"
import { Status, Directory, Books, SortOrder } from "@books/shared"
import { DropdownButton, Dropdown } from "react-bootstrap"
import Styles from "./ItemListTabContent.module.scss"
import classNames from "classnames"
import VirtualList from "./VirtualList"
import ItemLink from "./ItemLink"

interface BookTabProps {
	dir: Directory,
	status?: Status,
	searchWords: string[],
	statusChanged: (books: Books) => void,
	hidden: boolean,
}

const ItemListTabContent = (props: BookTabProps) => {
	const [sort, setSort] = useState(SortOrder.AlphabeticallyAscending)
	const items = new Directory(props.dir, undefined, sort)

	return (
		<>
			<div className={classNames(Styles.sortDropDown, { [Styles.hidden]: props.hidden })}>
				<DropdownButton title={`Sorted: ${sort}`} id={`${props.status || "All"}-sortButton`} variant="secondary">
					{Object.values(SortOrder).map(s => (
						<Dropdown.Item key={s} onClick={() => setSort(s)}>{s}</Dropdown.Item>
					))}
				</DropdownButton>
			</div>

			<VirtualList estimatedChildHeight={195} className={classNames({ [Styles.hidden]: props.hidden })}>
				{items.items.map(i => <ItemLink key={i.id} item={i} {...props} />)}
			</VirtualList>
		</>
	)
}

export default ItemListTabContent