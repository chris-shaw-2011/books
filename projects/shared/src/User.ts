export default class User {
	email: string
	password?: string
	id: string
	isAdmin: boolean
	lastLogin?: number

	get lastLoginDate() {
		if (this.lastLogin !== undefined) {
			return new Date(this.lastLogin)
		}

		return undefined
	}

	constructor(json?: Partial<User>) {
		this.email = json?.email ?? ""

		if (json?.password !== undefined) {
			this.password = json.password
		}

		this.id = json?.id ?? ""
		this.isAdmin = json?.isAdmin ?? false

		if (json?.lastLogin !== undefined) {
			this.lastLogin = json.lastLogin
		}
	}

	public isValid() {
		return this.id !== "" && this.email !== ""
	}
}
