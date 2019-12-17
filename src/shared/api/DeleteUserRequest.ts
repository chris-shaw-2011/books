import ApiMessage, { ApiMessageType } from "./ApiMessage";
import Token from "./Token";

export default class DeleteUserRequest extends ApiMessage {
   userId = ""
   token = new Token()

   constructor(json?: DeleteUserRequest) {
      super(ApiMessageType.DeleteUserRequest)

      if (json) {
         this.userId = json.userId
         this.token = new Token(json.token)
      }
   }
}