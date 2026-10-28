import { use, useId, useMemo, useState } from "react"
import type { Item } from "@books/shared"
import Styles from "./ItemListTabContent.module.scss"
import ItemLink from "./ItemLink"
import { Virtuoso } from "react-virtuoso"
import DropdownButton from "./components/DropdownButton"
import AudibleImportContext from "./context/AudibleImportContext"
import { itemOrders, orderItems, type ItemOrder } from "./ItemOrder"
import CheckboxField from "./components/CheckboxField"
import OkButton from "./components/OkButton"

interface BookTabProps {
	items: readonly Item[],
	toolbarControls?: React.ReactNode,
}

// TODO: give this a better name, it's misleading
const ItemListTabContent = ({ items, toolbarControls }: BookTabProps) => {
	const [sort, setSort] = useState<ItemOrder>("Alphabetically - Ascending")
	const controller = use(AudibleImportContext)
	const sorted = useMemo(() => orderItems(items, sort), [items, sort])
	const selecting = controller?.selecting && controller.available.length > 0
	const allSelected = controller && controller.selected.length === controller.available.length
	const sortId = useId()

	return (
		<>
			<div className={Styles.toolbar}>
				<DropdownButton
					title={`Sorted: ${sort}`}
					id={sortId}
					onSelect={setSort}
					options={(Object.keys(itemOrders) as ItemOrder[]).map(value => ({ label: value, value }))}
					variant="secondary"
				/>
				{toolbarControls}
				{selecting && (
					<>
						<CheckboxField label="Select all available books" checked={allSelected} indeterminate={controller.selected.length > 0 && !allSelected} disabled={controller.busy} onChange={event => controller.select(event.target.checked ? controller.available.map(book => book.asin) : [])} />
						<OkButton disabled={controller.busy || controller.selected.length === 0} value={controller.busy ? "Starting downloads…" : "Download selected"} />
						<span role="status">{`${controller.selected.length} of ${controller.available.length} selected`}</span>
					</>
				)}
			</div>
			{/* Keep import form controls mounted for validation, including offscreen books. */}
			{controller ? sorted.map(item => <ItemLink key={item.id} item={item} />) : <Virtuoso data={sorted} computeItemKey={(_, item) => item.id} itemContent={(_, item) => <ItemLink item={item} />} />}
		</>
	)
}

export default ItemListTabContent
