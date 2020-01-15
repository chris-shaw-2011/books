import { Status } from "./Book"

export class BookWithStatus {
   dateStatusSet = 0
   status = Status.Unread

   constructor(json?: BookWithStatus) {
      if (json) {
         this.status = json.status
         this.dateStatusSet = json.dateStatusSet
      }
   }
}

export default class BookStatuses {
   [key: string]: BookWithStatus | undefined

   constructor(json?: BookStatuses) {
      if (json) {
         Object.keys(json).forEach(k => {
            if (json[k] && json[k]?.dateStatusSet) {
               this[k] = new BookWithStatus(json[k])
            }
         })
      }
   }
}