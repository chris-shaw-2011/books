import { Status } from "../shared/Book"

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

export default class BookStatuses extends Map<string, BookWithStatus> {
   constructor(json?: Array<any>) {
      super()

      if (json) {
         json.forEach(obj => {
            const key = Object.keys(obj)[0]
            const value = new BookWithStatus(obj[key])

            this.set(key, value)
         })
      }
   }

   toJSON() {
      var object = [];

      for (let [key, value] of this) {
         var obj: any = {}
         obj[key] = value;

         object.push(obj)
      }

      return object;
   }
}