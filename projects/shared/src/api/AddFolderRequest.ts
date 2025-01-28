import ApiMessage from "./ApiMessage.js"

export default class AddFolderRequest extends ApiMessage {
	override readonly type = "AddFolderRequest"

	path: string
	folderName: string

	constructor(json?: Partial<AddFolderRequest>) {
		super()

		this.path = json?.path ?? ""
		this.folderName = json?.folderName ?? ""
	}
}
