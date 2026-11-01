import typia from "typia"
import ApiMessage from "./ApiMessage.ts"

export default class AddFolderRequest extends ApiMessage {
	override readonly type = "AddFolderRequest"

	static fromUnknown(json: unknown) {
		return new AddFolderRequest(typia.assert<ConstructorParameters<typeof AddFolderRequest>[0]>(json))
	}

	path = ""
	folderName = ""

	constructor(json?: Partial<AddFolderRequest>) {
		super()
		this.assignDefined(typia.plain.clone<Partial<AddFolderRequest>>(json ?? {}))
	}
}
