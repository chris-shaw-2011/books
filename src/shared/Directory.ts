import Book from "./Book"
import BookStatuses from "./BookStatuses"
import { ItemType } from "./ItemType"
import SortOrder from "./SortOrder"

export default class Directory {
   items: (Directory | Book)[] = []
   name = ""
   id = ""
   uploadTime = new Date()
   hasBooks = true
   folderPath = ""
   readonly type = ItemType.directory

   constructor(json?: Directory, bookStatuses?: BookStatuses, sortOrder?: SortOrder) {
      if (json) {
         this.name = json.name
         this.id = json.id
         this.hasBooks = json.hasBooks
         this.folderPath = json.folderPath
         let uploadSet = false

         json.items.forEach(i => {
            let upload: Date

            if (i.type === ItemType.book) {
               const status = bookStatuses ? bookStatuses[i.id]?.status : undefined
               const book = new Book(i, status)

               this.items.push(new Book(i, status))

               upload = book.uploadTime
            }
            else {
               const dir = new Directory(i, bookStatuses, sortOrder)

               this.items.push(dir)
               upload = dir.uploadTime
            }

            if (sortOrder === SortOrder.UploadedAscending && (!uploadSet || upload < this.uploadTime)) {
               uploadSet = true
               this.uploadTime = upload
            }
            else if (sortOrder === SortOrder.UploadedDescending && (!uploadSet || upload > this.uploadTime)) {
               uploadSet = true
               this.uploadTime = upload
            }
         })

         if (sortOrder) {
            if (sortOrder === SortOrder.AlphabeticallyDescending) {
               this.items.reverse()
            }
            else if (sortOrder === SortOrder.UploadedAscending) {
               this.items.sort((a, b) => {
                  return a.uploadTime > b.uploadTime ? 1 : -1
               })
            }
            else if (sortOrder === SortOrder.UploadedDescending) {
               this.items.sort((a, b) => {
                  return a.uploadTime > b.uploadTime ? -1 : 1
               })
            }
            else if (sortOrder !== SortOrder.AlphabeticallyAscending) {
               throw Error(`Unhandled sort order: ${sortOrder}`)
            }
         }
      }
   }

   bookCount() {
      let count = 0

      this.items.forEach(i => {
         if (i.type === ItemType.book) {
            count += 1
         }
         else {
            count += i.bookCount()
         }
      })

      return count
   }

   toJSON() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const directory: any = { ...this }

      delete directory.uploadTime

      return directory
   }
}
