import User from "../User"
import ApiMessage, { ApiMessageType } from "./ApiMessage"

export default class Token extends ApiMessage {
   user: User = new User()
   authorization: string = ""
   checksum: string = ""

   constructor(json?: Token) {
      super(ApiMessageType.Token)
      if (json) {
         this.user = new User(json.user)
         this.authorization = json.authorization
         this.checksum = json.checksum
      }
   }
}
