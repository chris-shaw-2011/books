import Book, { Status } from "./Book"
import BookStatuses from "./BookStatuses"
import { ItemType } from "./ItemType"

export default class Directory {
   items: Array<Directory | Book> = []
   name = ""
   id = ""
   readonly type = ItemType.directory

   constructor(json?: Directory, bookStatuses?: BookStatuses) {
      if (json) {
         this.name = json.name
         this.id = json.id

         json.items.forEach(i => {
            if (i.type === ItemType.book) {
               const status = bookStatuses ? bookStatuses[i.id]?.status : Status.Unread

               this.items.push(new Book(i, status))
            }
            else {
               this.items.push(new Directory(i, bookStatuses))
            }
         })
      }
   }

   bookCount() {
      let count = 0

      this.items.forEach(i => {
         if (i.type === ItemType.book) {
            count += 1
         } else {
            count += (i as Directory).bookCount()
         }
      })

      return count
   }
}
