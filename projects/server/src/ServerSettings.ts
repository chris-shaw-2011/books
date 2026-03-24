import nodemailer from "nodemailer"
import * as sqlite from "sqlite"
import { v4 as uuid } from "uuid"
import { Settings } from "@books/shared"

const SettingKeys = ["baseBooksPath", "checksumSecret", "inviteEmail", "inviteEmailPassword", "uploadLocation"] as const

type ValidSettings = typeof SettingKeys[number]

export default class ServerSettings extends Settings {
	private _db: sqlite.Database

	checksumSecret = ""
	mailer = this.createMailer()

	constructor(db: sqlite.Database) {
		super()
		this._db = db

		return new Proxy(this, {
			get<T extends keyof ServerSettings>(target: ServerSettings, prop: T): ServerSettings[T] | undefined {
				if (prop in target) {
					return target[prop]
				}
				return undefined
			},
			set<T extends keyof ServerSettings>(target: ServerSettings, prop: T, value: ServerSettings[T]): boolean {
				if (prop in target) {
					target[prop] = value
					return true
				}
				return false
			},
		})
	}

	static async loadFromDatabase(db: sqlite.Database) {
		const settings = new ServerSettings(db)
		const dbSettings = await db.all("SELECT key, value FROM setting")

		dbSettings.forEach((row: { key: string, value: string }) => {
			const key = row.key as ValidSettings

			if (SettingKeys.includes(key)) {
				settings[key] = row.value
			}
			else {
				// eslint-disable-next-line no-console
				console.error("Unepxected setting found", row.key)
			}
		})

		settings.mailer = settings.createMailer()

		if (!settings.checksumSecret) {
			// eslint-disable-next-line no-console
			console.log("Creating checksum secret")

			settings.checksumSecret = uuid()
			await ServerSettings.updateDbSetting(db, "checksumSecret", settings.checksumSecret)

			// eslint-disable-next-line no-console
			console.log("checksum secret set", settings.checksumSecret)
		}

		return settings
	}

	toJSON() {
		return new Settings(this)
	}

	private static async updateDbSetting(db: sqlite.Database, name: ValidSettings, value: string) {
		await db.run(`REPLACE INTO setting (key, value) VALUES('${name}', ?)`, value)
	}

	public async updateDbSettings() {
		for (const k of SettingKeys) {
			await ServerSettings.updateDbSetting(this._db, k, this[k])
		}

		this.mailer.close()
		this.mailer = this.createMailer()
	}

	private createMailer() {
		return nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: this.inviteEmail,
				pass: this.inviteEmailPassword,
			},
		})
	}
}
