import User from "../User"
import ApiMessage, { ApiMessageType } from "./ApiMessage"

export default class Token extends ApiMessage {
   user = new User()
   authorization = ""
   checksum = ""

   constructor(json?: Token) {
      super(ApiMessageType.Token)
      if (json) {
         this.user = new User(json.user)
         this.authorization = json.authorization
         this.checksum = json.checksum
      }
   }
}
