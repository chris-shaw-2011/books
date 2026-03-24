import * as sqlite from "sqlite"
import sqlite3 from "sqlite3"
import ServerSettings from "./ServerSettings.ts"
import * as shared from "@books/shared"
import path from "path"

// TODO: save the book metadata to the database so we don't have to wait on the server to read all books on a restart
// TODO: update this to better-sqlite-3
// The server should still read the books but it shouldn't be blocking
// This todo has a dependency on enabling a websocket to notify on book updates
class DatabaseClass extends sqlite.Database {
	noUsers = true
	settings!: ServerSettings
	// private database: sqlite.Database

	constructor() {
		const dbLocationFlag = "--db-location"
		const dbLocationIndex = process.argv.indexOf(dbLocationFlag)
		const locationArg = dbLocationIndex !== -1 ? process.argv[dbLocationIndex + 1] : undefined

		const dbLocation = path.resolve(locationArg ?? process.env.BOOKS_DB_LOCATION ?? "db.sqlite")

		// eslint-disable-next-line no-console
		console.log(`Using database located at: ${dbLocation}}`)

		super({ filename: dbLocation, driver: sqlite3.Database })

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
		const qr = (await this.get<{ bookStatuses: string }>("SELECT bookStatuses FROM user WHERE id = ?", userId))

		return new shared.BookStatuses(JSON.parse(qr?.bookStatuses ?? "{}") as Record<string, Partial<shared.BookWithStatus>>)
	}
}

const Database = new DatabaseClass()

export default Database
