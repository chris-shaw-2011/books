import typia from "typia"
export default class Settings {
	static fromUnknown(json: unknown) {
		return new Settings(typia.assert<typia.Primitive<Settings>>(json))
	}

	baseBooksPath: string
	inviteEmail: string
	inviteEmailPassword: string
	uploadLocation: string

	constructor(json?: Partial<Settings>) {
		const data = json ?? {}

		this.baseBooksPath = data.baseBooksPath ?? process.env.DEFAULT_BASE_BOOKS_PATH ?? ""
		this.inviteEmail = data.inviteEmail ?? process.env.DEFAULT_INVITE_EMAIL ?? ""
		this.inviteEmailPassword = data.inviteEmailPassword ?? process.env.DEFAULT_INVITE_EMAIL_PASSWORD ?? ""
		this.uploadLocation = data.uploadLocation ?? process.env.DEFAULT_UPLOAD_LOCATION ?? ""
	}
}
