import ApiMessage from "./ApiMessage.js"

export default class SettingsUpdateResponse extends ApiMessage {
	override readonly type = "SettingsUpdateResponse"

	successful: boolean
	message: string

	constructor(json?: Partial<SettingsUpdateResponse>) {
		super()

		this.successful = json?.successful ?? false
		this.message = json?.message ?? ""
	}
}
