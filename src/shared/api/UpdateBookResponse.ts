import ApiMessage, { ApiMessageType } from "./ApiMessage"
import Books from "./Books"

export default class UpdateBookResponse extends ApiMessage {
   message = ""
   books?: Books

   constructor(json?: UpdateBookResponse) {
      super(ApiMessageType.UpdateBookResponse)

      if (json) {
         this.message = json.message
         this.books = json.books ? new Books(json.books) : undefined
      }
   }
}
