import { ItemType } from "./ItemType"

export enum Status {
   Unread,
   Read
}

export default class Book {
   name: string = ""
   author: string = ""
   numBytes: number = 0
   cover: string = ""
   download: string = ""
   status: Status = Status.Unread
   year?: number
   comment: string = ""
   duration?: number
   readonly type = ItemType.book

   constructor(json?: Book) {
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
      }
   }
}