import ApiMessage, { ApiMessageType } from "./ApiMessage"
import Settings from "../Settings"

export default class SettingsRequired extends ApiMessage {
   message: string = ""
   settings = new Settings()

   constructor(json?: SettingsRequired) {
      super(ApiMessageType.SettingsRequired)

      if (json) {
         this.message = json.message
         this.settings = new Settings(json.settings)
      }
   }
}