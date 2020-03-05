import { Mutex } from "async-mutex"
import { ChildProcess, exec } from "child_process"
import { EventEmitter } from "events"
import ffmpegPath from "ffmpeg-static"
import { path as ffprobePath } from "ffprobe-static"
import fs from "fs"
import * as mm from "music-metadata"
import path from "path"
import sanitize from "sanitize-filename"
import unzipper from "unzipper"
import { v4 as uuid } from "uuid"
import { ConverterStatus } from "../shared/ConverterStatus"

export default class Converter {
   totalDuration = 0
   _percentComplete = 0
   eventEmitter = new EventEmitter()
   errorMessage = ""
   private _status = ConverterStatus.Waiting
   get percentComplete() {
      return this._percentComplete
   }
   set percentComplete(value: number) {
      this._percentComplete = value
      this.eventEmitter.emit("update")
   }
   get status() {
      return this._status
   }
   set status(value: ConverterStatus) {
      this._status = value
      this.eventEmitter.emit("update")
   }

   waitForUpdate = async (knownPercent: number, knownStatus: ConverterStatus) => {
      if (knownPercent === this.percentComplete && this.status !== ConverterStatus.Complete && this.status !== ConverterStatus.Error && this.status === knownStatus) {
         const promise = new Promise<number>((resolve, reject) => {
            this.eventEmitter.once("update", resolve)
         })

         return await Promise.race([promise, new Promise<number>((resolve, reject) => {
            setTimeout(() => { this.eventEmitter.removeListener("update", resolve); resolve() }, 10000)
         })])
      }
   }

   parseData = (data: any, outputFile: string) => {
      const str: string = data.toString()

      if (this.totalDuration === 0) {
         const matches = str.match(/Duration: ([\d]{1,3}):([\d]{1,2})(?::([\d]{1,2}))?.*, start/)

         if (matches) {
            this.totalDuration = this.durationToSeconds(matches)
         }
      }
      else {
         const matches = str.match(/frame=.* time=([\d]{1,3}):([\d]{1,2})(?::([\d]{1,2}))?.* bitrate=/)

         if (matches) {
            const completeDuration = this.durationToSeconds(matches)

            this.percentComplete = Math.round(completeDuration / this.totalDuration * 100)

            // tslint:disable-next-line: no-console
            console.log(`${outputFile} - ${this.percentComplete}% complete`)
         }
      }
   }

   convert = async (fileName: string, baseFilePath: string, mutex: Mutex, rootDir: string) => {
      return await mutex.runExclusive(async () => {
         if (fileName.endsWith(".aax")) {
            await this.convertAax(fileName, baseFilePath, rootDir)
         }
         else if (fileName.endsWith(".zip")) {
            await this.convertMp3(fileName, baseFilePath)
         }
      })
   }

   private convertMp3 = async (fileName: string, baseFilePath: string) => {
      this.status = ConverterStatus.Unzipping

      const zipPath = path.join(baseFilePath, fileName)
      const unzipPath = zipPath.replace(".zip", "")
      const openFile = (await unzipper.Open.file(zipPath))
      const files = openFile.files
      const sizeToUnzip = files.map(f => f.uncompressedSize).reduce((totalSize: number, currSize) => totalSize + currSize)
      let sizeUnzipped = 0

      await fs.promises.mkdir(unzipPath)

      // Create directories first
      for (const file of files) {
         const destPath = path.join(unzipPath, file.path)

         if (file.type === "Directory" && !fs.existsSync(destPath)) {
            fs.mkdirSync(destPath)
         }
         else {
            const destParsed = path.parse(destPath)

            if (!fs.existsSync(destParsed.dir)) {
               fs.mkdirSync(destParsed.dir, { recursive: true })
            }

            await new Promise(resolve => file.stream().pipe(fs.createWriteStream(path.join(unzipPath, file.path))).on("finish", resolve))
            sizeUnzipped += file.uncompressedSize

            this.percentComplete = Math.round((sizeUnzipped / sizeToUnzip) * 100)
         }
      }

      await fs.promises.unlink(zipPath)

      if (await this.combineMp3s(unzipPath, baseFilePath)) {
         await fs.promises.rmdir(unzipPath, { recursive: true })
         this.status = ConverterStatus.Complete
      }
   }

   private combineMp3s = async (currPath: string, baseFilePath: string): Promise<boolean> => {
      this._percentComplete = 0
      this.status = ConverterStatus.Converting

      const paths = await fs.promises.readdir(currPath, { withFileTypes: true })

      if (paths.length === 1 && paths[0].isDirectory()) {
         return await this.combineMp3s(path.join(currPath, paths[0].name), baseFilePath)
      }

      const mp3s = []
      let bestCover = ""
      let bestCoverSize = 0
      let outputName = ""
      const addMetaData = (args: string[], key: string, value: string | number | undefined) => {
         if (value !== undefined) {
            if (typeof value === "number") {
               args.push("-metadata", `${key}=${value}`)
            }
            else {
               args.push("-metadata", `${key}="${value.replace("\"", "\\\"")}"`)
            }
         }
      }

      for (const p of paths) {
         if (p.isFile()) {
            if (p.name.toLowerCase().endsWith(".mp3")) {
               mp3s.push(p.name)

               if (!outputName) {
                  outputName = p.name.replace("-Part00.mp3", "").replace("-Part01.mp3", "")
               }
            }
            else if (p.name.toLowerCase().endsWith("jpg")) {
               const size = (await fs.promises.stat(path.join(currPath, p.name))).size

               if (size > bestCoverSize) {
                  bestCover = p.name
                  bestCoverSize = size
               }
            }
         }
      }

      if (mp3s.length) {
         const outputFileName = `${uuid()}.mp3`
         const opt = { cwd: currPath, pipeStdio: true, metaDataOverrides: { title: outputName, coverPicturePath: bestCover } }
         const args = ["-i"]
         const metadata = opt.metaDataOverrides
         const coverPicturePath = metadata && metadata.coverPicturePath ? metadata.coverPicturePath : ""
         const outputFilePath = path.join(currPath, outputFileName)

         if (mp3s.length > 1) {
            args.push(`"concat:${mp3s.join("|")}"`)
         }
         else {
            args.push(`"${mp3s[0]}"`)
         }

         if (coverPicturePath) {
            args.push("-i", `"${coverPicturePath}"`)
         }

         args.push("-map", "0:0")

         if (coverPicturePath) {
            args.push("-map", "1:0")
         }

         args.push("-c", "copy", "-id3v2_version", "3")

         if (metadata) {
            /*addMetaData(args, "album", metadata.album)
            addMetaData(args, "artist", metadata.artist)
            addMetaData(args, "album_artist", metadata.albumArtist)
            addMetaData(args, "grouping", metadata.grouping)
            addMetaData(args, "composer", metadata.composer)
            addMetaData(args, "date", metadata.year)
            addMetaData(args, "track", metadata.trackNumber)
            addMetaData(args, "comment", metadata.comment)
            addMetaData(args, "genre", metadata.genre)
            addMetaData(args, "copyright", metadata.copyright)
            addMetaData(args, "description", metadata.description)
            addMetaData(args, "synopsis", metadata.synopsis)*/
            addMetaData(args, "title", metadata.title)
         }

         args.push(`"${outputFilePath}"`)

         if (!(await this.runFfmpeg(outputFilePath, args, currPath))) {
            return false
         }

         let finalFilePath = path.join(baseFilePath, outputName + ".mp3")

         if (fs.existsSync(finalFilePath)) {
            finalFilePath = path.join(baseFilePath, outputName + uuid() + ".mp3")
         }

         await fs.promises.rename(outputFilePath, finalFilePath)

         return true
      }

      return false
   }

   private convertAax = async (fileName: string, baseFilePath: string, rootDir: string) => {
      const outputFileName = `${fileName}.m4b`
      const outputFilePath = path.join(baseFilePath, outputFileName)
      const inputFilePath = path.join(baseFilePath, fileName)
      const encryptionKey = await this.crack(inputFilePath, rootDir)

      if (!encryptionKey) {
         return
      }

      this.status = ConverterStatus.Converting

      const args = ["-activation_bytes", encryptionKey, "-i", `"${inputFilePath}"`, "-c", "copy", `"${outputFilePath}"`]

      if (!(await this.runFfmpeg(outputFilePath, args, baseFilePath))) {
         return
      }

      await fs.promises.unlink(inputFilePath)

      const metadata = (await mm.parseFile(outputFilePath, { skipCovers: true, skipPostHeaders: true, includeChapters: false }))

      if (metadata.common.title) {
         const sanitized = sanitize(metadata.common.title.replace(/:/gi, " - "))
         let desiredFilePath = path.join(baseFilePath, `${sanitized}.m4b`)

         if (fs.existsSync(desiredFilePath)) {
            desiredFilePath = path.join(baseFilePath, `${sanitized} - ${outputFileName}`)
         }

         await fs.promises.rename(outputFilePath, desiredFilePath)
      }

      this.status = ConverterStatus.Complete
   }

   private crack = async (inputFilePath: string, rootDir: string) => {
      this.status = ConverterStatus.Cracking

      const ffprobe = exec(`${ffprobePath} "${inputFilePath}"`)
      let probeOutput = ""

      ffprobe.stdout?.on("data", data => probeOutput += data.toString())
      ffprobe.stderr?.on("data", data => probeOutput += data.toString())

      try {
         await onExit(ffprobe)
      }
      catch {
         this.errorMessage = probeOutput
         this.status = ConverterStatus.Error

         return ""
      }

      const matches = probeOutput.match(/file checksum == (.*)/)

      if (!matches) {
         this.errorMessage = `Couldn't find checksum from ffprobe

         ${probeOutput}`
         this.status = ConverterStatus.Error

         return ""
      }

      let crackerOutput = ""
      const cwd = path.join(rootDir, "src", "server", "inAudible-NG")
      const crackerPath = process.platform === "win32" ? path.join(cwd, "run", "rcrack.exe") : path.join(cwd, "rcrack")
      const cracker = exec(`"${crackerPath}" . -h ${matches[1]}`, { cwd })

      cracker.stdout?.on("data", data => crackerOutput += data.toString())
      cracker.stderr?.on("data", data => crackerOutput += data.toString())

      try {
         await onExit(cracker)
      }
      catch {
         this.errorMessage = crackerOutput
         this.status = ConverterStatus.Error

         return ""
      }

      const activationBytesMatches = crackerOutput.match(/hex\:(.*)/)

      if (activationBytesMatches) {
         return activationBytesMatches[1]
      }
      else {
         this.errorMessage = `Couldn't find activation bytes in cracker output

         ${crackerOutput}
         `
         this.status = ConverterStatus.Error

         return ""
      }
   }

   private async runFfmpeg(outputFilePath: string, args: string[], workingDirectory: string) {
      const logFile = `${outputFilePath}.ffmpeg.log`
      const ffmpeg = exec(`${ffmpegPath} ${args.join(" ")}`, { cwd: workingDirectory })

      ffmpeg.stdout?.on("data", data => this.parseData(data, outputFilePath))
      ffmpeg.stderr?.on("data", data => this.parseData(data, outputFilePath))

      ffmpeg.stderr?.pipe(fs.createWriteStream(logFile))

      try {
         await onExit(ffmpeg)
      }
      catch {
         this.errorMessage = await fs.promises.readFile(logFile, "utf8")
         this.status = ConverterStatus.Error

         return false
      }

      await fs.promises.unlink(logFile)

      return true
   }

   private durationToSeconds(matches: RegExpMatchArray) {
      let multiplier = 1
      let seconds = 0

      matches.reverse().forEach(m => {
         const num = parseInt(m, 10)

         if (m && !isNaN(num)) {
            seconds += num * multiplier
            multiplier *= 60
         }
      })

      return seconds
   }
}

function onExit(childProcess: ChildProcess): Promise<void> {
   return new Promise((resolve, reject) => {
      childProcess.once("exit", (code: number, signal: string) => {
         if (code === 0) {
            resolve(undefined)
         } else {
            reject(new Error("Exit with error code: " + code))
         }
      })
      childProcess.once("error", (err: Error) => {
         reject(err)
      })
   })
}
