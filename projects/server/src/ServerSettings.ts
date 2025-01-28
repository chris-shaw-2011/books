import nodemailer from "nodemailer"
import * as sqlite from "sqlite"
import { v4 as uuid } from "uuid"
import { Settings } from "@books/shared"

export default class ServerSettings extends Settings {
	override get baseBooksPath() {
		return this._baseBooksPath
	}
	override set baseBooksPath(value: string) {
		if (this._baseBooksPath !== value) {
			this._baseBooksPath = value
			this.updateDbSetting("baseBooksPath", value)
		}
	}

	get checksumSecret() {
		return this._checksumSecret
	}
	set checksumSecret(value: string) {
		if (this._checksumSecret !== value) {
			this._checksumSecret = value
			this.updateDbSetting("checksumSecret", value)
		}
	}

	override get inviteEmail() {
		return this._inviteEmail
	}
	override set inviteEmail(value: string) {
		if (this._inviteEmail !== value) {
			this._inviteEmail = value
			this.updateDbSetting("inviteEmail", value)
			this.mailer = this.createMailer()
		}
	}

	override get inviteEmailPassword() {
		return this._inviteEmailPassword
	}
	override set inviteEmailPassword(value: string) {
		if (this._inviteEmailPassword !== value) {
			this._inviteEmailPassword = value
			this.updateDbSetting("inviteEmailPassword", value)
			this.mailer = this.createMailer()
		}
	}

	override get uploadLocation() {
		return this._uploadLocation
	}
	override set uploadLocation(value: string) {
		if (this._uploadLocation !== value) {
			this._uploadLocation = value
			this.updateDbSetting("uploadLocation", value)
		}
	}
	mailer = this.createMailer()
	private _checksumSecret = ""
	private _db: sqlite.Database

	constructor(db: sqlite.Database) {
		super()
		this._db = db
	}

	static async loadFromDatabase(db: sqlite.Database) {
		const settings = new ServerSettings(db)

		if (!settings.checksumSecret) {
			settings.checksumSecret = uuid()

			// eslint-disable-next-line no-console
			console.log("Creating checksum secret")
		}

		(await db.all("SELECT key, value FROM setting")).forEach((row: { key: string, value: string }) => {
			switch (row.key) {
				case "baseBooksPath": {
					settings._baseBooksPath = row.value
					break
				}
				case "checksumSecret": {
					settings._checksumSecret = row.value
					break
				}
				case "inviteEmail": {
					settings._inviteEmail = row.value
					break
				}
				case "inviteEmailPassword": {
					settings._inviteEmailPassword = row.value
					break
				}
				case "uploadLocation": {
					settings._uploadLocation = row.value
					break
				}
			}
		})

		settings.mailer = settings.createMailer()

		return settings
	}

	toJSON() {
		return new Settings(this)
	}

	private updateDbSetting(name: string, value: string) {
		void this._db.run(`REPLACE INTO setting (key, value) VALUES('${name}', ?)`, value)
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
