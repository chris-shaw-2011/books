import * as sqlite from "sqlite"
import sqlite3 from "sqlite3"
import ServerSettings from "./ServerSettings"

class DatabaseClass implements sqlite.Database<sqlite3.Database, sqlite3.Statement> {
	config!: sqlite.ISqlite.Config
	db!: sqlite3.Database
	noUsers!: boolean
	settings!: ServerSettings
	private database!: sqlite.Database<sqlite3.Database, sqlite3.Statement>

	async open() {
		if (!this.database) {
			this.database = await sqlite.open({ filename: "db.sqlite", driver: sqlite3.Database })
			await this.database.exec(`
            CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT, hash TEXT, isAdmin BOOLEAN, lastLogin BIGINT, bookStatuses TEXT);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_user_email ON user (email);
         `)

			await this.database.exec("PRAGMA user_version = 1")

			this.settings = new ServerSettings(this.database)

			await this.settings.loadFromDatabase()

			this.noUsers = ((await this.database.get<{ userCount: number }>("SELECT COUNT(1) as userCount FROM user")) ?? { userCount: 0 }).userCount === 0

			if (this.noUsers) {
				// eslint-disable-next-line no-console
				console.warn("Currently there are no users in the database so the first login attempt will create a user")
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, listener: any): void {
		this.database.on(event, listener)
	}
	getDatabaseInstance(): sqlite3.Database {
		return this.database.getDatabaseInstance()
	}
	close(): Promise<void> {
		return this.database.close()
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configure(option: sqlite.ISqlite.ConfigureOption, value: any) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return this.database.configure(option, value)
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	run(sql: sqlite.ISqlite.SqlType, ...params: any[]): Promise<sqlite.ISqlite.RunResult<sqlite3.Statement>> {
		return this.database.run(sql, params)
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	get<T = any>(sql: sqlite.ISqlite.SqlType, ...params: any[]): Promise<T | undefined> {
		return this.database.get(sql, params)
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	each<T = any>(sql: sqlite.ISqlite.SqlType, ...params: any[]): Promise<number> {
		return this.database.each<T>(sql, params)
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	all<T = any[]>(sql: sqlite.ISqlite.SqlType, ...params: any[]): Promise<T> {
		return this.database.all<T>(sql, params)
	}
	exec(sql: sqlite.ISqlite.SqlType): Promise<void> {
		return this.database.exec(sql)
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	prepare(sql: sqlite.ISqlite.SqlType, ...params: any[]): Promise<sqlite.Statement<sqlite3.Statement>> {
		return this.database.prepare(sql, params)
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	loadExtension(path: string): Promise<any> {
		return this.database.loadExtension(path)
	}
	migrate(config?: sqlite.IMigrate.MigrationParams | undefined): Promise<void> {
		return this.migrate(config)
	}
	serialize(): void {
		this.database.serialize()
	}
	parallelize(): void {
		this.database.parallelize()
	}
}

const Database = new DatabaseClass()

export default Database
