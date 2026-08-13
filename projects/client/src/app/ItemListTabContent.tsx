import { useState } from "react"
import { type Status, Directory, SortOrderValues, type SortOrder } from "@books/shared"
import Styles from "./ItemListTabContent.module.scss"
import classNames from "classnames"
import ItemLink from "./ItemLink"
import { Virtuoso } from "react-virtuoso"
import DropdownButton from "./components/DropdownButton"

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
				<DropdownButton
					title={`Sorted: ${sort}`}
					id={`${props.status ?? "All"}-sortButton`}
					onSelect={setSort}
					options={SortOrderValues.map(value => ({ label: value, value }))}
					variant="secondary"
				/>
			</div>
			<Virtuoso
				data={items.items}
				itemContent={(_, item) => <ItemLink {...props} key={item.id} item={item} />}
			/>
		</>
	)
}

export default ItemListTabContent
