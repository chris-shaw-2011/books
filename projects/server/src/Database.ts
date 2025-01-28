import * as sqlite from "sqlite"
import sqlite3 from "sqlite3"
import ServerSettings from "./ServerSettings.js"
import * as shared from "@books/shared"

class DatabaseClass extends sqlite.Database {
	noUsers = true
	settings!: ServerSettings
	//private database: sqlite.Database

	constructor() {
		super({ filename: "db.sqlite", driver: sqlite3.Database })

		void this.open()
	}

	override async open() {
		await super.open()
		await this.exec(`
            CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT, hash TEXT, isAdmin BOOLEAN, lastLogin BIGINT, bookStatuses TEXT);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_user_email ON user (email);
         `)

		await this.exec("PRAGMA user_version = 1")

		this.settings = await ServerSettings.loadFromDatabase(this)

		this.noUsers = ((await this.get<{ userCount: number }>("SELECT COUNT(1) as userCount FROM user")) ?? { userCount: 0 }).userCount === 0

		if (this.noUsers) {
			// eslint-disable-next-line no-console
			console.warn("Currently there are no users in the database so the first login attempt will create a user")
		}
	}

	async statusesForUser(userId: string) {
		const qr = (await this.get<{ bookStatuses: string }>("SELECT bookStatuses FROM User WHERE id = ?", userId))

		return shared.BookStatuses.fromJSON(qr?.bookStatuses)
	}
}

const Database = new DatabaseClass()

export default Database