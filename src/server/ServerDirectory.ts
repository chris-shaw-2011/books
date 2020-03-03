import fs from "fs"
import * as mm from "music-metadata"
import path from "path"
import stripHtml from "string-strip-html"
import Book from "../shared/Book"
import Directory from "../shared/Directory"
import db from "./Database"

export default class ServerDirectory extends Directory {

   /**
    *
    * @param searchingPath The path we're looking for
    * @param pathToCheck The current path to check for a partial match
    */
   static isPartialPathMatch(searchingPath: string, pathToCheck: string) {
      return searchingPath.indexOf(pathToCheck) === 0
   }

   fullPath: string
   items: (ServerDirectory | Book)[] = []
   parent?: ServerDirectory
   pathTree: string[] = []

   findClosestDirectory(dirPath: string): ServerDirectory | undefined {
      for (const item of this.items) {
         if (item instanceof ServerDirectory) {
            if (ServerDirectory.isPartialPathMatch(dirPath, item.fullPath)) {
               return item.findClosestDirectory(dirPath) || item
            }
         }
      }

      if (dirPath.indexOf(this.fullPath) !== -1) {
         return this
      }
   }

   deleteBook(fullPath: path.ParsedPath) {
      const bookFullPath = path.join(fullPath.dir, fullPath.base)
      let closestDir = this.findClosestDirectory(fullPath.dir)

      if (closestDir) {
         for (let index = 0; index < closestDir.items.length; ++index) {
            const item = closestDir.items[index]

            if (item.fullPath === bookFullPath) {
               // tslint:disable-next-line: no-console
               console.log(`Removing book ${item.fullPath}`)

               closestDir.items.splice(index, 1)

               break
            }
         }

         while (closestDir && closestDir.parent && closestDir.items.length === 0) {
            // tslint:disable-next-line: no-console
            console.log(`Removing directory ${closestDir.fullPath}`)

            closestDir.parent.items.splice(closestDir.parent.items.indexOf(closestDir), 1)

            closestDir = closestDir.parent
         }
      }
   }

   async loadBooks(updatePath?: path.ParsedPath): Promise<boolean> {
      const pathTree = this.pathTree
      const currPath = path.join(db.settings.baseBooksPath, ...pathTree, this.name)
      const paths = await fs.promises.readdir(currPath, { withFileTypes: true })
      const newPathTree = this.name ? pathTree.concat(this.name) : pathTree
      const updatePathFullPath = updatePath ? path.join(updatePath.dir, updatePath.base) : undefined

      this.id = newPathTree.join("/")
      this.fullPath = currPath

      for (const p of paths) {
         const fullPath = path.join(currPath, p.name)

         if (p.isDirectory()) {
            if (!updatePathFullPath || ServerDirectory.isPartialPathMatch(updatePathFullPath, fullPath)) {
               const dir = new ServerDirectory()

               dir.name = p.name
               dir.pathTree = newPathTree

               if (await dir.loadBooks(updatePath)) {
                  dir.parent = this
                  this.items.push(dir)
               }
            }
         }
         else if (p.isFile() && (p.name.endsWith(".m4b") || p.name.endsWith(".mp3")) && (!updatePathFullPath || fullPath === updatePathFullPath)) {
            const book = new Book()
            const photoPath = fullPath + ".jpg"
            const bookUri = newPathTree.concat(p.name).join("/")

            // tslint:disable-next-line: no-console
            console.log(`${fullPath} - reading tags`)

            const metadata = (await mm.parseFile(fullPath, { skipPostHeaders: true, skipCovers: fs.existsSync(photoPath), includeChapters: false }))
            const tags = metadata.common
            const stats = (await fs.promises.stat(fullPath))

            if (tags) {
               book.name = p.name
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
            book.numBytes = stats.size
            book.fullPath = fullPath
            book.uploadTime = stats.birthtime

            this.items.push(book)

            if (updatePathFullPath) {
               this.items.sort((a, b) => {
                  const nameA = a.name.toUpperCase()
                  const nameB = b.name.toUpperCase()

                  if (nameA > nameB) {
                     return 1
                  }
                  else if (nameA < nameB) {
                     return -1
                  }

                  return 0
               })
            }
         }
      }

      if (this.items.length) {
         this.sortItems()

         return true
      }
      else {
         return false
      }
   }

   sortItems(sortParent?: boolean) {
      this.items.sort((a, b) => {
         return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      })

      if (sortParent) {
         this.parent?.sortItems(sortParent)
      }
   }
}
