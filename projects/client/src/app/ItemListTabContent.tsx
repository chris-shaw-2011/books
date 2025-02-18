import { useState } from "react"
import { type Status, Directory, SortOrderValues, type SortOrder } from "@books/shared"
import { DropdownButton, Dropdown } from "react-bootstrap"
import Styles from "./ItemListTabContent.module.scss"
import classNames from "classnames"
import ItemLink from "./ItemLink"
import { Virtuoso } from "react-virtuoso"

interface BookTabProps {
	dir: Directory,
	status?: Status,
}

const ItemListTabContent = (props: BookTabProps) => {
	const [sort, setSort] = useState<SortOrder>("Alphabetically - Ascending")
	const items = new Directory(props.dir, undefined, sort)

	return (
		<>
			<div className={classNames(Styles.sortDropDown)}>
				<DropdownButton title={`Sorted: ${sort}`} id={`${props.status ?? "All"}-sortButton`} variant="secondary">
					{SortOrderValues.map(s => (
						<Dropdown.Item key={s} onClick={() => { setSort(s) }}>{s}</Dropdown.Item>
					))}
				</DropdownButton>
			</div>
			<Virtuoso
				data={items.items}
				itemContent={(_, item) => <ItemLink {...props} key={item.id} item={item} />}
			/>
		</>
	)
}

export default ItemListTabContent