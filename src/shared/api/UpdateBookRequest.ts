import Book from "../Book"
import ApiMessage, { ApiMessageType } from "./ApiMessage"
import Token from "./Token"

export default class UpdateBookRequest extends ApiMessage {
   token = new Token()
   newBook = new Book()
   prevBook = new Book()

   constructor(json?: UpdateBookRequest) {
      super(ApiMessageType.UpdateBookRequest)

      if (json) {
         this.token = new Token(json.token)
         this.newBook = new Book(json.newBook)
         this.prevBook = new Book(json.prevBook)
      }
   }
}
