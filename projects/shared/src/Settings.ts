export default class Settings {
	baseBooksPath: string
	inviteEmail: string
	inviteEmailPassword: string
	uploadLocation: string

	constructor(json?: Partial<Settings>) {
		this.baseBooksPath = json?.baseBooksPath ?? ""
		this.inviteEmail = json?.inviteEmail ?? ""
		this.inviteEmailPassword = json?.inviteEmailPassword ?? ""
		this.uploadLocation = json?.uploadLocation ?? ""
	}
}