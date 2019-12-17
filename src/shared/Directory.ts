import Book from "./Book"
import { ItemType } from "./ItemType"

export default class Directory {
   items: Array<Directory | Book> = []
   name = ""
   id = ""
   readonly type = ItemType.directory

   constructor(json?: Directory) {
      if (json) {
         this.name = json.name
         this.id = json.id

         json.items.forEach(i => {
            if (i.type === ItemType.book) {
               this.items.push(new Book(i))
            }
            else {
               this.items.push(new Directory(i))
            }
         })
      }
   }

   bookCount() {
      var count = 0;

      this.items.forEach(i => {
         if (i.type === ItemType.book) {
            count += 1;
         }
         else {
            count += (i as Directory).bookCount()
         }
      })

      return count;
   }
}