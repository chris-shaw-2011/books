import ApiMessage, { ApiMessageType } from "./ApiMessage";
import User from "../User";
import Token from "./Token";

export default class AddUserRequest extends ApiMessage {
   user = new User()
   token = new Token()

   constructor(json?: AddUserRequest) {
      super(ApiMessageType.AddUserRequest)

      if (json) {
         this.user = new User(json.user)
         this.token = new Token(json.token)
      }
   }
}