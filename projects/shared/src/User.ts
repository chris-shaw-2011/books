import typia from "typia"
export default class User {
	static fromUnknown(json: unknown) {
		return new User(typia.assert<typia.Primitive<User>>(json))
	}

	email: string
	password?: string
	id: string
	isAdmin: boolean
	lastLogin?: Date

	constructor(json?: Partial<User> | Partial<typia.Primitive<User>>) {
		const data = json ?? {}
		this.email = data.email ?? ""

		if (data.password !== undefined) {
			this.password = data.password
		}

		this.id = data.id ?? ""
		this.isAdmin = data.isAdmin ?? false

		if (data.lastLogin !== undefined) {
			this.lastLogin = new Date(data.lastLogin)
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
