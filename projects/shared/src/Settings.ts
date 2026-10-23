export default class Settings {
	baseBooksPath: string
	inviteEmail: string
	inviteEmailPassword: string
	uploadLocation: string

	constructor(json?: Partial<Settings>) {
		this.baseBooksPath = json?.baseBooksPath ?? process.env.DEFAULT_BASE_BOOKS_PATH ?? ""
		this.inviteEmail = json?.inviteEmail ?? process.env.DEFAULT_INVITE_EMAIL ?? ""
		this.inviteEmailPassword = json?.inviteEmailPassword ?? process.env.DEFAULT_INVITE_EMAIL_PASSWORD ?? ""
		this.uploadLocation = json?.uploadLocation ?? process.env.DEFAULT_UPLOAD_LOCATION ?? ""
	}
}
