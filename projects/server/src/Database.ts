import { backup, DatabaseSync, type SQLOutputValue, type SQLTagStore } from "node:sqlite"
import { randomUUID } from "node:crypto"
import path from "path"
import * as shared from "@books/shared"
import ServerSettings, { type SettingsStore, type ValidSettings } from "./ServerSettings.ts"
import ServerUser from "./ServerUser.ts"

const CurrentSchemaVersion = 2
const KnownSchemaVersions = new Set([0, 1, CurrentSchemaVersion])
const MigrationAdvice = "Run `npm run migrate-db --workspace=@books/server` before starting the server."

interface SettingRow {
	key: string,
	value: string,
}

interface UserRow {
	id: string,
	email: string,
	hash: string | null,
	isAdmin: 0 | 1,
	lastLogin: number | null,
	bookStatuses: string,
}

type SqlRow = Record<string, SQLOutputValue>

function expectString(value: SQLOutputValue, fieldName: string): string {
	if (typeof value !== "string") {
		throw new TypeError(`${fieldName} must be a string`)
	}

	return value
}

function expectOptionalString(value: SQLOutputValue, fieldName: string): string | null {
	if (value === null) {
		return null
	}

	return expectString(value, fieldName)
}

function expectInteger(value: SQLOutputValue, fieldName: string): number {
	if (typeof value === "number" && Number.isInteger(value)) {
		return value
	}

	if (typeof value === "bigint") {
		return Number(value)
	}

	throw new TypeError(`${fieldName} must be an integer`)
}

function expectOptionalInteger(value: SQLOutputValue, fieldName: string): number | null {
	if (value === null) {
		return null
	}

	return expectInteger(value, fieldName)
}

function expectBooleanInteger(value: SQLOutputValue, fieldName: string): 0 | 1 {
	const num = expectInteger(value, fieldName)

	if (num !== 0 && num !== 1) {
		throw new TypeError(`${fieldName} must be 0 or 1`)
	}

	return num
}

function expectRow(row: SqlRow | undefined, message: string): SqlRow {
	if (row === undefined) {
		throw new ReferenceError(message)
	}

	return row
}

function mapSettingRow(row: SqlRow): SettingRow {
	return {
		key: expectString(row.key ?? null, "setting.key"),
		value: expectString(row.value ?? null, "setting.value"),
	}
}

function mapUserRow(row: SqlRow): UserRow {
	return {
		id: expectString(row.id ?? null, "user.id"),
		email: expectString(row.email ?? null, "user.email"),
		hash: expectOptionalString(row.hash ?? null, "user.hash"),
		isAdmin: expectBooleanInteger(row.isAdmin ?? null, "user.isAdmin"),
		lastLogin: expectOptionalInteger(row.lastLogin ?? null, "user.lastLogin"),
		bookStatuses: expectString(row.bookStatuses ?? "{}", "user.bookStatuses"),
	}
}

function toSharedUser(row: UserRow): shared.User {
	const userData: Partial<shared.User> = {
		id: row.id,
		email: row.email,
		isAdmin: row.isAdmin === 1,
	}

	if (row.lastLogin !== null) {
		userData.lastLogin = new Date(row.lastLogin)
	}

	return new shared.User(userData)
}

function toServerUser(row: UserRow): ServerUser {
	const userData: Partial<shared.User> = {
		id: row.id,
		email: row.email,
		isAdmin: row.isAdmin === 1,
	}

	if (row.lastLogin !== null) {
		userData.lastLogin = new Date(row.lastLogin)
	}

	const user = new ServerUser(userData)

	user.hash = row.hash ?? ""

	return user
}

function sanitizeTimestampForFilename(date: Date): string {
	return date.toISOString().replaceAll(":", "-").replaceAll(".", "-")
}

function normalizeAdminValue(value: SQLOutputValue): 0 | 1 {
	if (typeof value === "number") {
		return value === 0 ? 0 : 1
	}

	if (typeof value === "bigint") {
		return value === 0n ? 0 : 1
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase()

		if (normalized === "" || normalized === "0" || normalized === "false") {
			return 0
		}

		return 1
	}

	if (value === null) {
		return 0
	}

	throw new TypeError("Could not normalize user.isAdmin during migration")
}

function normalizeLastLoginValue(value: SQLOutputValue): number | null {
	if (value === null) {
		return null
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? Math.trunc(value) : null
	}

	if (typeof value === "bigint") {
		return Number(value)
	}

	if (typeof value === "string") {
		const trimmed = value.trim()

		if (trimmed === "") {
			return null
		}

		const numericValue = Number(trimmed)

		if (Number.isFinite(numericValue)) {
			return Math.trunc(numericValue)
		}

		const parsedDate = Date.parse(trimmed)

		if (!Number.isNaN(parsedDate)) {
			return parsedDate
		}
	}

	throw new TypeError("Could not normalize user.lastLogin during migration")
}

function normalizeBookStatusesValue(value: SQLOutputValue): string {
	if (value === null) {
		return "{}"
	}

	if (typeof value !== "string") {
		throw new TypeError("Could not normalize user.bookStatuses during migration")
	}

	if (value.trim() === "") {
		return "{}"
	}

	try {
		const parsed = JSON.parse(value) as unknown

		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return JSON.stringify(parsed)
		}
	}
	catch {
		return "{}"
	}

	return "{}"
}

function configureConnection(database: DatabaseSync) {
	database.exec("PRAGMA journal_mode = WAL")
	database.exec("PRAGMA synchronous = NORMAL")
	database.exec("PRAGMA foreign_keys = ON")

	const maybeDefensive = (database as DatabaseSync & { enableDefensive?: (active: boolean) => void }).enableDefensive

	if (typeof maybeDefensive === "function") {
		maybeDefensive.call(database, true)
	}
}

function readUserVersion(database: DatabaseSync): number {
	const row = expectRow(database.prepare("PRAGMA user_version").get(), "Failed to read PRAGMA user_version")
	const version = row.user_version

	return expectInteger(version ?? null, "PRAGMA user_version")
}

function readApplicationTableNames(database: DatabaseSync): string[] {
	return database.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('setting', 'user') ORDER BY name",
	).all().map(row => expectString(row.name ?? null, "sqlite_master.name"))
}

function initializeDatabase(database: DatabaseSync) {
	database.exec(`
	CREATE TABLE IF NOT EXISTS setting (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	) STRICT;

	CREATE TABLE IF NOT EXISTS user (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL,
		hash TEXT,
		isAdmin INTEGER NOT NULL CHECK (isAdmin IN (0, 1)),
		lastLogin INTEGER,
		bookStatuses TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(bookStatuses))
	) STRICT;

	CREATE UNIQUE INDEX IF NOT EXISTS IX_user_email ON user (email);
	PRAGMA user_version = ${CurrentSchemaVersion};
`)
}

function assertSupportedSchema(database: DatabaseSync, dbLocation: string) {
	const version = readUserVersion(database)

	if (!KnownSchemaVersions.has(version)) {
		throw new Error(`Unsupported database schema version ${version} at ${dbLocation}.`)
	}

	if (version === CurrentSchemaVersion) {
		return
	}

	const tableNames = readApplicationTableNames(database)

	if (version === 0 && tableNames.length === 0) {
		initializeDatabase(database)
		return
	}

	if (version === 1) {
		throw new Error(`Database schema version 1 detected at ${dbLocation}. ${MigrationAdvice}`)
	}

	throw new Error(`Unsupported unversioned database detected at ${dbLocation}. ${MigrationAdvice}`)
}

export function resolveDatabaseLocation() {
	const dbLocationFlag = "--db-location"
	const dbLocationIndex = process.argv.indexOf(dbLocationFlag)
	const locationArg = dbLocationIndex !== -1 ? process.argv[dbLocationIndex + 1] : undefined

	return path.resolve(locationArg ?? process.env.BOOKS_DB_LOCATION ?? "db.sqlite")
}

export async function migrateLegacyDatabase(dbLocation = resolveDatabaseLocation()) {
	const database = new DatabaseSync(dbLocation, {
		enableForeignKeyConstraints: true,
		timeout: 5000,
	})

	try {
		configureConnection(database)

		const version = readUserVersion(database)

		if (version === CurrentSchemaVersion) {
			return null
		}

		if (version !== 1) {
			throw new Error(`Expected schema version 1 at ${dbLocation}, found ${version}.`)
		}

		const legacySettings = database.prepare("SELECT key, value FROM setting ORDER BY key").all().map(row => ({
			key: expectString(row.key ?? null, "setting.key"),
			value: row.value === null || row.value === undefined ? "" : expectString(row.value, "setting.value"),
		}))
		const legacyUsers = database.prepare("SELECT id, email, hash, isAdmin, lastLogin, bookStatuses FROM user ORDER BY email").all().map(row => ({
			id: expectString(row.id ?? null, "user.id"),
			email: expectString(row.email ?? null, "user.email"),
			hash: row.hash === null || row.hash === undefined ? null : expectString(row.hash, "user.hash"),
			isAdmin: normalizeAdminValue(row.isAdmin ?? 0),
			lastLogin: normalizeLastLoginValue(row.lastLogin ?? null),
			bookStatuses: normalizeBookStatusesValue(row.bookStatuses ?? null),
		}))

		const backupPath = `${dbLocation}.${sanitizeTimestampForFilename(new Date())}.backup.sqlite`

		await backup(database, backupPath)

		database.exec("BEGIN IMMEDIATE")

		try {
			database.exec(`
				DROP INDEX IF EXISTS IX_user_email;
				ALTER TABLE setting RENAME TO setting_v1;
				ALTER TABLE user RENAME TO user_v1;
			`)
			initializeDatabase(database)

			const insertSetting = database.prepare("INSERT INTO setting (key, value) VALUES (?, ?)")
			const insertUser = database.prepare(
				"INSERT INTO user (id, email, hash, isAdmin, lastLogin, bookStatuses) VALUES (?, ?, ?, ?, ?, ?)",
			)

			for (const setting of legacySettings) {
				insertSetting.run(setting.key, setting.value)
			}

			for (const user of legacyUsers) {
				insertUser.run(user.id, user.email, user.hash, user.isAdmin, user.lastLogin, user.bookStatuses)
			}

			database.exec(`
				DROP TABLE setting_v1;
				DROP TABLE user_v1;
				PRAGMA user_version = ${CurrentSchemaVersion};
				COMMIT;
			`)
		}
		catch (error) {
			if (database.isTransaction) {
				database.exec("ROLLBACK")
			}

			throw error
		}

		return backupPath
	}
	finally {
		database.close()
	}
}

class DatabaseClass implements SettingsStore {
	#database: DatabaseSync | undefined
	#sql: SQLTagStore | undefined

	noUsers = true
	settings!: ServerSettings

	open() {
		if (this.#database?.isOpen) {
			return
		}

		const dbLocation = resolveDatabaseLocation()
		const database = new DatabaseSync(dbLocation, {
			open: false,
			enableForeignKeyConstraints: true,
			timeout: 5000,
		})

		database.open()
		configureConnection(database)
		assertSupportedSchema(database, dbLocation)

		this.#database = database
		this.#sql = database.createTagStore()
		this.settings = ServerSettings.loadFromDatabase(this)
		this.noUsers = this.getUserCount() === 0

		// eslint-disable-next-line no-console
		console.log(`Using database located at: ${dbLocation}`)

		if (this.noUsers) {
			// eslint-disable-next-line no-console
			console.warn("Currently there are no users in the database so the first login attempt will create a user")
		}
	}

	close() {
		if (!this.#database?.isOpen) {
			return
		}

		try {
			this.settings.mailer.close()
		}
		catch {
			// Ignore mailer shutdown errors.
		}

		this.#sql?.clear()
		this.#database.close()
		this.#sql = undefined
		this.#database = undefined
	}

	getSettingRows() {
		return this.sql.all`SELECT key, value FROM setting ORDER BY key`.map(mapSettingRow)
	}

	updateSetting(name: ValidSettings, value: string) {
		return this.database.prepare("REPLACE INTO setting (key, value) VALUES (?, ?)").run(name, value)
	}

	getUserCount() {
		const row = expectRow(this.sql.get`SELECT COUNT(1) AS userCount FROM user`, "Failed to count users")

		return expectInteger(row.userCount ?? null, "userCount")
	}

	getAllUsers() {
		return this.allUserRows().map(toSharedUser)
	}

	getUserById(userId: string) {
		const row = this.sql.get`
			SELECT id, email, hash, isAdmin, lastLogin, bookStatuses
			FROM user
			WHERE id = ${userId}
		`

		return row === undefined ? undefined : toServerUser(mapUserRow(row))
	}

	getUserByEmail(email: string) {
		const row = this.sql.get`
			SELECT id, email, hash, isAdmin, lastLogin, bookStatuses
			FROM user
			WHERE email = ${email}
		`

		return row === undefined ? undefined : toServerUser(mapUserRow(row))
	}

	hasUserWithEmail(email: string) {
		return this.sql.get`SELECT 1 AS found FROM user WHERE email = ${email}` !== undefined
	}

	createBootstrapAdmin(email: string, hash: string) {
		return this.transaction(() => {
			if (this.getUserCount() !== 0) {
				this.noUsers = false

				return null
			}

			const userId = randomUUID()

			this.database.prepare(
				"INSERT INTO user (id, email, hash, isAdmin, bookStatuses) VALUES (?, ?, ?, ?, ?)",
			).run(userId, email, hash, 1, "{}")
			this.noUsers = false

			return userId
		})
	}

	insertInvitedUser(userId: string, email: string, isAdmin: boolean) {
		this.database.prepare(
			"INSERT INTO user (id, email, isAdmin, bookStatuses) VALUES (?, ?, ?, ?)",
		).run(userId, email, isAdmin ? 1 : 0, "{}")
		this.noUsers = false
	}

	deleteUser(userId: string) {
		this.database.prepare("DELETE FROM user WHERE id = ?").run(userId)
		this.noUsers = this.getUserCount() === 0
	}

	updateUserPassword(userId: string, hash: string) {
		return this.database.prepare("UPDATE user SET hash = ? WHERE id = ?").run(hash, userId)
	}

	updateUserLastLogin(userId: string, lastLogin: Date) {
		return this.database.prepare("UPDATE user SET lastLogin = ? WHERE id = ?").run(lastLogin.getTime(), userId)
	}

	statusesForUser(userId: string) {
		const row = this.sql.get`SELECT bookStatuses FROM user WHERE id = ${userId}`

		if (row === undefined) {
			return new shared.BookStatuses()
		}

		const bookStatuses = expectString(row.bookStatuses ?? "{}", "user.bookStatuses")

		return new shared.BookStatuses(JSON.parse(bookStatuses) as Record<string, Partial<shared.BookWithStatus>>)
	}

	updateStatusesForUser(userId: string, statuses: shared.BookStatuses) {
		return this.database.prepare("UPDATE user SET bookStatuses = ? WHERE id = ?").run(JSON.stringify(statuses), userId)
	}

	replaceBookStatusId(bookId: string, replacementBookId: string) {
		const bookIdJson = JSON.stringify(bookId)
		const replacementBookIdJson = JSON.stringify(replacementBookId)

		return this.database.prepare(
			"UPDATE user SET bookStatuses = REPLACE(bookStatuses, ?, ?) WHERE bookStatuses LIKE ?",
		).run(bookIdJson, replacementBookIdJson, `%${bookIdJson}%`)
	}

	transaction<T>(runInTransaction: () => T): T {
		const database = this.database

		if (database.isTransaction) {
			return runInTransaction()
		}

		database.exec("BEGIN IMMEDIATE")

		try {
			const result = runInTransaction()

			database.exec("COMMIT")

			return result
		}
		catch (error) {
			try {
				database.exec("ROLLBACK")
			}
			catch {
				// Ignore rollback errors when SQLite already aborted the transaction.
			}
			throw error
		}
	}

	get database() {
		if (!this.#database?.isOpen) {
			throw new Error("Database connection is not open")
		}

		return this.#database
	}

	get sql() {
		if (this.#sql === undefined) {
			throw new Error("SQL tag store is not initialized")
		}

		return this.#sql
	}

	private allUserRows() {
		return this.sql.all`
			SELECT id, email, hash, isAdmin, lastLogin, bookStatuses
			FROM user
			ORDER BY email
		`.map(mapUserRow)
	}
}

const Database = new DatabaseClass()

export default Database
