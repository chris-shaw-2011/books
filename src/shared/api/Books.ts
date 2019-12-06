import ApiMessage, { ApiMessageType } from "./ApiMessage";
import Directory from "../Directory";

export default class Books extends ApiMessage {
   directory = new Directory()

   constructor(json?: Books) {
      super(ApiMessageType.Books)

      if (json) {
         this.directory = new Directory(json.directory)
      }
   }
}