export default class User {
	email: string
	password?: string
	id: string
	isAdmin: boolean
	lastLogin?: Date

	constructor(json?: Partial<User>) {
		this.email = json?.email ?? ""

		if (json?.password !== undefined) {
			this.password = json.password
		}

		this.id = json?.id ?? ""
		this.isAdmin = json?.isAdmin ?? false

		if (json?.lastLogin) {
			this.lastLogin = new Date(json.lastLogin)
		}
	}

	public isValid() {
		return this.id !== "" && this.email !== ""
	}

	toJSON(): Omit<User, "lastLogin" | "toJSON" | "isValid"> & { lastLogin?: number | undefined } {
		return {
			email: this.email,
			password: this.password ?? "",
			id: this.id,
			isAdmin: this.isAdmin,
			lastLogin: this.lastLogin ? new Date(this.lastLogin).getTime() : undefined,
		}
	}
}