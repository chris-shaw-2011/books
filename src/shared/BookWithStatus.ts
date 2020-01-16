import { Status } from "./Book"


export default class BookWithStatus {
   dateStatusSet = 0
   status = Status.Unread

   constructor(json?: BookWithStatus) {
      if (json) {
         this.status = json.status
         this.dateStatusSet = json.dateStatusSet
      }
   }
}
