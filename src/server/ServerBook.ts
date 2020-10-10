import Book, { Status } from "../shared/Book"
import * as mm from "music-metadata"
import fs from "fs"
import ServerDirectory from "./ServerDirectory"
import path from "path"

export default class ServerBook extends Book {
   fullPath = ""
   parent = new ServerDirectory()
   photoPath = ""

   static calculateBookId(directory: ServerDirectory, filePath: string) {
      const pathTree = directory.pathTree.concat(!directory.name ? [] : directory.name)
      const fileName = path.win32.basename(filePath)

      return pathTree.concat(fileName).join("/")
   }

   constructor(json?: ServerBook, status?: Status) {
      super(json, status)

      if (json) {
         this.fullPath = json.fullPath
         this.parent = json.parent
         this.photoPath = json.photoPath
      }
   }

   async updateMetadata(filePath?: string) {
      const fullPath = filePath ?? this.fullPath
      const fileName = path.win32.basename(fullPath)
      const bookUri = ServerBook.calculateBookId(this.parent, fullPath)

      this.photoPath = `${fullPath}.jpg`

      // tslint:disable-next-line: no-console
      console.log(`${fullPath} - reading tags`)

      const metadata = (await mm.parseFile(fullPath, { skipPostHeaders: true, skipCovers: fs.existsSync(this.photoPath), includeChapters: false }))
      const tags = metadata.common
      const stats = (await fs.promises.stat(fullPath))

      if (tags) {
         this.name = tags.title || fileName
         this.author = tags.artist || ""
         this.year = tags.year
         this.comment = tags.comment && tags.comment.length ? tags.comment[0] : ""
         this.duration = metadata.format.duration
         this.narrator = tags.composer?.length ? tags.composer[0] : ""
         this.genre = tags.genre?.length ? tags.genre[0] : ""

         if (tags.picture && tags.picture.length && !fs.existsSync(this.photoPath)) {
            fs.writeFileSync(this.photoPath, new Uint8Array(tags.picture[0].data))
         }
      }
      else {
         this.name = fileName
      }

      this.id = bookUri
      this.download = `/files/${bookUri}`
      this.cover = `${this.download}.jpg`
      this.numBytes = stats.size
      this.fullPath = fullPath
      this.uploadTime = stats.birthtime
      this.folderPath = path.parse(`/${bookUri}`).dir
   }
}