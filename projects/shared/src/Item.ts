import type Book from "./Book.ts"
import type Directory from "./Directory.ts"

export type Item = Book | Directory
export type ItemType = "Book" | "Directory"

export default abstract class ItemBase {
	abstract readonly type: ItemType

	id: string
	name: string
	folderPath: string

	constructor(json?: Partial<ItemBase>) {
		this.id = json?.id ?? ""
		this.name = json?.name ?? ""
		this.folderPath = json?.folderPath ?? ""
	}
}
