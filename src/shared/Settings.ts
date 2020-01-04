export default class Settings {
   baseBooksPath: string = "";
   inviteEmail = ""
   inviteEmailPassword = ""
   uploadLocation = ""

   constructor(json?: Settings) {
      if (json) {
         this.baseBooksPath = json.baseBooksPath
         this.inviteEmail = json.inviteEmail
         this.inviteEmailPassword = json.inviteEmailPassword
         this.uploadLocation = json.uploadLocation
      }
   }
}