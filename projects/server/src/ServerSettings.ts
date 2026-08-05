import nodemailer from "nodemailer"
import * as crypto from "node:crypto"
import { Settings } from "@books/shared"

const SettingKeys = ["baseBooksPath", "checksumSecret", "inviteEmail", "inviteEmailPassword", "uploadLocation"] as const

export type ValidSettings = typeof SettingKeys[number]

export interface SettingsStore {
	getSettingRows: () => { key: string, value: string }[],
	updateSetting: (name: ValidSettings, value: string) => void,
}

export default class ServerSettings extends Settings {
	private _db: SettingsStore

	checksumSecret = ""
	mailer = this.createMailer()

	constructor(db: SettingsStore) {
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

	static loadFromDatabase(db: SettingsStore) {
		const settings = new ServerSettings(db)
		const dbSettings = db.getSettingRows()

		dbSettings.forEach(row => {
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

			settings.checksumSecret = crypto.randomUUID()
			ServerSettings.updateDbSetting(db, "checksumSecret", settings.checksumSecret)

			// eslint-disable-next-line no-console
			console.log("checksum secret set", settings.checksumSecret)
		}

		return settings
	}

	toJSON() {
		return new Settings(this)
	}

	private static updateDbSetting(db: SettingsStore, name: ValidSettings, value: string) {
		db.updateSetting(name, value)
	}

	public updateDbSettings() {
		for (const k of SettingKeys) {
			ServerSettings.updateDbSetting(this._db, k, this[k])
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
