import ApiMessage, { ApiMessageType } from "./ApiMessage"
import Token from "./Token"

export default class ChangePasswordRequest extends ApiMessage {
   newPassword = ""
   token = new Token()

   constructor(json?: ChangePasswordRequest) {
      super(ApiMessageType.ChangePasswordRequest)

      if (json) {
         this.newPassword = json.newPassword
         this.token = new Token(json.token)
      }
   }
}
