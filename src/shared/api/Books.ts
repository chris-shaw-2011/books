import ApiMessage, { ApiMessageType } from "./ApiMessage";
import Directory from "../Directory";
import BookStatuses from "../BookStatuses";

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