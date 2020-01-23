import { ItemType } from "./ItemType"

export enum Status {
   Unread = "Unread",
   Read = "Read",
   Skipped = "Skipped",
}

export default class Book {
   name = ""
   author = ""
   numBytes = 0
   cover = ""
   download = ""
   status = Status.Unread
   year?: number
   comment = ""
   duration?: number
   id = ""
   fullPath = ""
   readonly type = ItemType.book

   constructor(json?: Book, status?: Status) {
      if (json) {
         this.name = json.name
         this.author = json.author
         this.numBytes = json.numBytes
         this.cover = json.cover
         this.download = json.download
         this.status = json.status
         this.year = json.year
         this.comment = json.comment
         this.duration = json.duration
         this.id = json.id
      }

      if (status) {
         this.status = status
      }
   }

   toJSON() {
      const json = { ...this }
      json.fullPath = ""

      return json
   }
}
