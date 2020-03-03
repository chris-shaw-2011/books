import chokidar from "chokidar"
import fs from "fs"
import path from "path"
import db from "./Database"
import ServerDirectory from "./ServerDirectory"

class BookList {
   private books = new ServerDirectory()
   private loadingPromise?: Promise<boolean>
   private watcher?: chokidar.FSWatcher
   private fileAddedPendingUpdates: (() => Promise<void>)[] = []

   constructor() {
      setTimeout(this.checkForFileAddedPendingUpdates, 60000)
   }

   async loadBooks() {
      if (this.watcher) {
         this.watcher.close()
         this.watcher = undefined
      }

      // tslint:disable-next-line: no-console
      console.log(`Loading books from ${db.settings.baseBooksPath}`)
      this.books = new ServerDirectory()
      this.loadingPromise = this.books.loadBooks()

      await this.loadingPromise

      this.loadingPromise = undefined

      // tslint:disable-next-line: no-console
      console.log(`${this.books.bookCount()} Books loaded`)

      this.watcher = chokidar.watch(db.settings.baseBooksPath, {
         ignored: (checkPath: string, stats?: fs.Stats) => {
            if (!stats) {
               return false
            }

            checkPath = path.normalize(checkPath)

            if (stats.isDirectory()) {
               if (checkPath.startsWith(db.settings.uploadLocation) && db.settings.uploadLocation !== checkPath) {
                  return true
               }

               return false
            }
            else {
               const parsed = path.parse(checkPath)

               if (parsed.base && parsed.ext !== ".mp3" && parsed.ext !== ".m4b") {
                  return true
               }

               return false
            }
         },
         ignoreInitial: true,
         awaitWriteFinish: {
            stabilityThreshold: 5000,
            pollInterval: 1000,
         },
         ignorePermissionErrors: true,
         usePolling: true,
         interval: 60000,
         binaryInterval: 60000,
      })
         .on("add", addPath => {
            this.fileAddedPendingUpdates.push(() => this.fileAdded(addPath))
         })
         .on("unlink", delPath => {
            // tslint:disable-next-line: no-console
            console.log(`file removed: ${delPath}`)

            this.books.deleteBook(path.parse(delPath))
         })
   }

   checkForFileAddedPendingUpdates = async () => {
      while (this.fileAddedPendingUpdates.length) {
         const fileAddedPendingUpdate = this.fileAddedPendingUpdates.shift()!

         await fileAddedPendingUpdate()
      }

      setTimeout(this.checkForFileAddedPendingUpdates, 60000)
   }

   async fileAdded(addPath: string) {
      // tslint:disable-next-line: no-console
      console.log(`file added: ${addPath}`)

      const dir = this.books.findClosestDirectory(addPath)

      await dir?.loadBooks(path.parse(addPath))

      dir?.sortItems(true)
   }

   async allBooks() {
      if (this.loadingPromise) {
         await this.loadingPromise
      }

      return this.books
   }
}

export default new BookList()
