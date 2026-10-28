import { AudibleImportDirectory, Directory, type Item } from "@books/shared"

const alphabetically = (first: Item, second: Item) => first.name.toLowerCase().localeCompare(second.name.toLowerCase())
const uploadTime = (item: Item, bound: "minUploadTime" | "maxUploadTime") => (item.type === "Book" ? item.uploadTime : item[bound])?.getTime() ?? 0

export const itemOrders = {
	"Alphabetically - Ascending": alphabetically,
	"Alphabetically - Descending": (first: Item, second: Item) => alphabetically(second, first),
	"Uploaded - Ascending": (first: Item, second: Item) => uploadTime(first, "minUploadTime") - uploadTime(second, "minUploadTime"),
	"Uploaded - Descending": (first: Item, second: Item) => uploadTime(second, "maxUploadTime") - uploadTime(first, "maxUploadTime"),
}

export type ItemOrder = keyof typeof itemOrders

export function orderItems(items: readonly Item[], order: ItemOrder): Item[] {
	return items.toSorted(itemOrders[order]).map(item => {
		if (item.type === "Book") return item
		const directory = item instanceof AudibleImportDirectory ? new AudibleImportDirectory() : new Directory()
		return Object.assign(directory, item, { items: orderItems(item.items, order) })
	})
}
