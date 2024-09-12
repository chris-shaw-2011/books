export default class User {
	email = ""
	password?: string
	id = ""
	isAdmin = false
	lastLogin = 0

	get lastLoginDate() {
		return new Date(this.lastLogin)
	}

	constructor(json?: User) {
		if (json) {
			this.email = json.email
			this.password = json.password
			this.id = json.id
			this.isAdmin = json.isAdmin
			this.lastLogin = json.lastLogin
		}
	}
}
