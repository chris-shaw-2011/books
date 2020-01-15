import Directory from "../shared/Directory"
import BookStatuses from "../shared/BookStatuses";
import path from "path"
import fs from "fs"
import db from "./Database"
import Book from "../shared/Book";
import * as mm from "music-metadata"
import stripHtml from "string-strip-html"
import Token from "../shared/api/Token"

class BookList {
   private books = new Directory()
   private loadingPromise?: Promise<Directory>

   async loadBooks() {
      console.log(`Loading books from ${db.settings.baseBooksPath}`)
      this.loadingPromise = this.loadBooksRecursive([], "")

      this.books = await this.loadingPromise
      this.loadingPromise = null;

      console.log(`${this.books.bookCount()} Books loaded`)
   }

   async allBooks() {
      if (this.loadingPromise) {
         await this.loadingPromise
      }

      return this.books;
   }

   private async loadBooksRecursive(pathTree: string[], name: string): Promise<Directory | null> {
      var currPath = path.join(db.settings.baseBooksPath, ...pathTree, name)
      var paths = await fs.promises.readdir(currPath, { withFileTypes: true });
      var newPathTree = name ? pathTree.concat(name) : pathTree;
      var dir = new Directory();

      dir.name = name;
      dir.id = newPathTree.join("/")

      for (const p of paths) {
         if (p.isDirectory()) {
            var result = await this.loadBooksRecursive(newPathTree, p.name);

            if (result) {
               dir.items.push(result)
            }
         }
         else if (p.isFile() && (p.name.endsWith(".m4b") || p.name.endsWith(".mp3"))) {
            var book = new Book();
            var bookPath = path.join(currPath, p.name);
            var photoPath = bookPath + ".jpg"
            const bookUri = newPathTree.concat(p.name).join("/")

            console.log(`${bookPath} - reading tags`)

            const metadata = (await mm.parseFile(bookPath, { skipPostHeaders: true, skipCovers: fs.existsSync(photoPath), includeChapters: false, }));
            const tags = metadata.common

            if (tags) {
               book.name = tags.title || p.name;
               book.author = tags.artist || "";
               book.year = tags.year;
               book.comment = tags.comment && tags.comment.length ? stripHtml(tags.comment[0]) : "";
               book.duration = metadata.format.duration

               if (tags.picture && tags.picture.length && !fs.existsSync(photoPath)) {
                  fs.writeFileSync(photoPath, new Uint8Array(tags.picture[0].data));
               }
            }
            else {
               book.name = p.name
            }

            book.id = bookUri
            book.download = `/files/${bookUri}`
            book.cover = book.download + ".jpg";
            book.numBytes = (await fs.promises.stat(bookPath)).size;

            dir.items.push(book);
         }
      }

      if (dir.items.length) {
         return dir;
      }
      else {
         return null;
      }
   }
}

const bookList = new BookList()

export default bookList

/*

const bookStatuses = async (userId: string) => {
   return
}
const bookList = async (token: Token) => {
   var dir = new Directory(books);

   dir.id = "root"

   UpdateUrlsAndStatus(dir, token.authorization, token.user.id, await bookStatuses(token.user.id));

   return new Books({ type: ApiMessageType.Books, directory: dir })
}


function UpdateUrlsAndStatus(dir: Directory, authorization: string, userId: string, bookStatuses: BookStatuses) {
   for (const i of dir.items) {
      if (i.type == ItemType.book) {
         var bookStatus = bookStatuses.get(i.id)

         i.status = bookStatus ? bookStatus.status : Status.Unread
      }
      else {
         UpdateUrlsAndStatus(i, authorization, userId, bookStatuses)
      }
   }
}*/

