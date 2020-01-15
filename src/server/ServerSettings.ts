import uuid from "uuid";
import Settings from "../shared/Settings"
import sqlite from "sqlite"
import nodemailer from "nodemailer"

export default class ServerSettings implements Settings {
   private _baseBooksPath = ""
   private _checksumSecret = ""
   private _inviteEmail = ""
   private _inviteEmailPassword = ""
   private _uploadLocation = ""
   private _db: sqlite.Database
   mailer = this.createMailer()

   get baseBooksPath() {
      return this._baseBooksPath
   }
   set baseBooksPath(value: string) {
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

   get inviteEmail() {
      return this._inviteEmail
   }
   set inviteEmail(value: string) {
      if (this._inviteEmail !== value) {
         this._inviteEmail = value
         this.updateDbSetting("inviteEmail", value)
         this.mailer = this.createMailer()
      }
   }

   get inviteEmailPassword() {
      return this._inviteEmailPassword
   }
   set inviteEmailPassword(value: string) {
      if (this._inviteEmailPassword !== value) {
         this._inviteEmailPassword = value
         this.updateDbSetting("inviteEmailPassword", value)
         this.mailer = this.createMailer()
      }
   }

   get uploadLocation() {
      return this._uploadLocation
   }
   set uploadLocation(value: string) {
      if (this._uploadLocation !== value) {
         this._uploadLocation = value
         this.updateDbSetting("uploadLocation", value)
      }
   }

   constructor(db: sqlite.Database) {
      this._db = db
   }

   async loadFromDatabase() {
      (await this._db.all("SELECT key, value FROM setting")).forEach((row: { key: string, value: string }) => {
         switch (row.key) {
            case "baseBooksPath": {
               this._baseBooksPath = row.value
               break;
            }
            case "checksumSecret": {
               this._checksumSecret = row.value;
               break;
            }
            case "inviteEmail": {
               this._inviteEmail = row.value
               break;
            }
            case "inviteEmailPassword": {
               this._inviteEmailPassword = row.value
               break;
            }
            case "uploadLocation": {
               this._uploadLocation = row.value
               break
            }
         }
      })

      if (!this.checksumSecret) {
         this.checksumSecret = uuid.v4()

         console.log("Creating checksum secret")
      }

      this.mailer = this.createMailer()
   }

   private updateDbSetting(name: string, value: string) {
      this._db.run(`REPLACE INTO setting (key, value) VALUES('${name}', ?)`, value)
   }

   private createMailer() {
      return nodemailer.createTransport({
         service: "gmail",
         auth: {
            user: this.inviteEmail,
            pass: this.inviteEmailPassword,
         }
      })
   }

   toJSON() {
      return new Settings(this)
   }
}