import BookWithStatus from "./BookWithStatus"

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
