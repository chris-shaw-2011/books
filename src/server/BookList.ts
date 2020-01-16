import fs from "fs"
import * as mm from "music-metadata"
import path from "path"
import stripHtml from "string-strip-html"
import Book from "../shared/Book"
import Directory from "../shared/Directory"
import db from "./Database"

class BookList {
   private books = new Directory()
   private loadingPromise?: Promise<Directory>

   async loadBooks() {
      // tslint:disable-next-line: no-console
      console.log(`Loading books from ${db.settings.baseBooksPath}`)
      this.loadingPromise = this.loadBooksRecursive([], "")

      this.books = await this.loadingPromise
      this.loadingPromise = null

      // tslint:disable-next-line: no-console
      console.log(`${this.books.bookCount()} Books loaded`)
   }

   async allBooks() {
      if (this.loadingPromise) {
         await this.loadingPromise
      }

      return this.books
   }

   private async loadBooksRecursive(pathTree: string[], name: string): Promise<Directory | null> {
      const currPath = path.join(db.settings.baseBooksPath, ...pathTree, name)
      const paths = await fs.promises.readdir(currPath, { withFileTypes: true })
      const newPathTree = name ? pathTree.concat(name) : pathTree
      const dir = new Directory()

      dir.name = name
      dir.id = newPathTree.join("/")

      for (const p of paths) {
         if (p.isDirectory()) {
            const result = await this.loadBooksRecursive(newPathTree, p.name)

            if (result) {
               dir.items.push(result)
            }
         }
         else if (p.isFile() && (p.name.endsWith(".m4b") || p.name.endsWith(".mp3"))) {
            const book = new Book()
            const bookPath = path.join(currPath, p.name)
            const photoPath = bookPath + ".jpg"
            const bookUri = newPathTree.concat(p.name).join("/")

            // tslint:disable-next-line: no-console
            console.log(`${bookPath} - reading tags`)

            const metadata = (await mm.parseFile(bookPath, { skipPostHeaders: true, skipCovers: fs.existsSync(photoPath), includeChapters: false }))
            const tags = metadata.common

            if (tags) {
               book.name = tags.title || p.name
               book.author = tags.artist || ""
               book.year = tags.year
               book.comment = tags.comment && tags.comment.length ? stripHtml(tags.comment[0]) : ""
               book.duration = metadata.format.duration

               if (tags.picture && tags.picture.length && !fs.existsSync(photoPath)) {
                  fs.writeFileSync(photoPath, new Uint8Array(tags.picture[0].data))
               }
            }
            else {
               book.name = p.name
            }

            book.id = bookUri
            book.download = `/files/${bookUri}`
            book.cover = book.download + ".jpg"
            book.numBytes = (await fs.promises.stat(bookPath)).size

            dir.items.push(book)
         }
      }

      if (dir.items.length) {
         return dir
      } else {
         return null
      }
   }
}

const bookList = new BookList()

export default bookList
