import BookStatuses from "../BookStatuses"
import Directory from "../Directory"
import ApiMessage, { ApiMessageType } from "./ApiMessage"

export default class Books extends ApiMessage {
   directory = new Directory()
   bookStatuses = new BookStatuses()

   constructor(json?: Books) {
      super(ApiMessageType.Books)

      if (json) {
         this.bookStatuses = new BookStatuses(json.bookStatuses)
         this.directory = new Directory(json.directory, this.bookStatuses)
      }
   }
}
