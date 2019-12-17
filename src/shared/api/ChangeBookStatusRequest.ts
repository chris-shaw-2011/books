import ApiMessage, { ApiMessageType } from "./ApiMessage";
import Token from "./Token";
import { Status } from "../Book";

export default class ChangeBookStatusRequest extends ApiMessage {
   token = new Token()
   bookId = ""
   status = Status.Unread

   constructor(json?: ChangeBookStatusRequest) {
      super(ApiMessageType.ChangeBookStatusRequest)

      if (json) {
         this.token = new Token(json.token)
         this.bookId = json.bookId
         this.status = json.status
      }
   }
}