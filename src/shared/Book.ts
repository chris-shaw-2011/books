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
   uploadTime = new Date(0)
   narrator = ""
   genre = ""
   folderPath = ""

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
         this.uploadTime = new Date(json.uploadTime)
         this.narrator = json.narrator
         this.genre = json.genre
         this.folderPath = json.folderPath
      }

      if (status) {
         this.status = status
      }
   }

   toJSON() {
      const json: any = { ...this }
      json.uploadTime = this.uploadTime.getTime()

      return json
   }
}
