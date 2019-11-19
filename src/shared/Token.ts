import User from "./User";

export default class Token {
   user: User = new User()
   authorization: string = ""
   checksum: string = ""

   constructor(json?: Token) {
      if (json) {
         this.user = new User(json.user)
         this.authorization = json.authorization
         this.checksum = json.checksum
      }
   }
}