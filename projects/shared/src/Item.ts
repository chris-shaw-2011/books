export type ItemType = "Book" | "Directory"

export default abstract class Item {
	abstract readonly type: ItemType

	id: string
	uploadTime: Date | number
	name: string
	folderPath: string

	constructor(json?: Omit<Partial<Item>, "uploadTime"> & { uploadTime?: Date | number }) {
		this.id = json?.id ?? ""
		this.uploadTime = new Date(json?.uploadTime ?? 0)
		this.name = json?.name ?? ""
		this.folderPath = json?.folderPath ?? ""
	}
}