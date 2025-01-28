export default class Settings {
	protected _baseBooksPath: string
	protected _inviteEmail: string
	protected _inviteEmailPassword: string
	protected _uploadLocation: string

	get baseBooksPath() { return this._baseBooksPath }
	get inviteEmail() { return this._inviteEmail }
	get inviteEmailPassword() { return this._inviteEmailPassword }
	get uploadLocation() { return this._uploadLocation }

	constructor(json?: Partial<Settings>) {
		this._baseBooksPath = json?.baseBooksPath ?? ""
		this._inviteEmail = json?.inviteEmail ?? ""
		this._inviteEmailPassword = json?.inviteEmailPassword ?? ""
		this._uploadLocation = json?.uploadLocation ?? ""
	}
}
