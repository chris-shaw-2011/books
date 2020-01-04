import ffmpegPath from "ffmpeg-static"
import { spawn, ChildProcess, ChildProcessWithoutNullStreams } from "child_process"
import fs from "fs"
import EventEmitter from "events"
import * as mm from "music-metadata"
import path from "path"
import sanitize from "sanitize-filename"
import { Mutex } from "async-mutex"
import { path as ffprobePath } from "ffprobe-static"
import { ConverterStatus } from "../shared/ConverterStatus"

export default class Converter {
   totalDuration = 0
   percentComplete = 0
   eventEmitter = new EventEmitter()
   errorMessage = ""
   private _status = ConverterStatus.Waiting
   get status() {
      return this._status
   }
   set status(value: ConverterStatus) {
      this._status = value
      this.eventEmitter.emit("update")
   }

   waitForUpdate = async (knownPercent: number, knownStatus: ConverterStatus) => {
      if (knownPercent === this.percentComplete && this.status !== ConverterStatus.Complete && this.status !== ConverterStatus.Error && this.status === knownStatus) {
         var promise = new Promise<number>((resolve, reject) => {
            this.eventEmitter.once("update", resolve)
         })

         return await Promise.race([promise, new Promise<number>((resolve, reject) => {
            setTimeout(() => { this.eventEmitter.removeListener("update", resolve); resolve() }, 10000);
         })])
      }
   }

   parseData = (data: any, outputFile: string) => {
      var str: string = data.toString()

      if (this.totalDuration === 0) {
         var matches = str.match(/Duration: ([\d]{1,3}):([\d]{1,2})(?::([\d]{1,2}))?.*, start/);

         if (matches) {
            this.totalDuration = this.durationToSeconds(matches)
         }
      }
      else {
         var matches = str.match(/frame=.* time=([\d]{1,3}):([\d]{1,2})(?::([\d]{1,2}))?.* bitrate=/);

         if (matches) {
            const completeDuration = this.durationToSeconds(matches)
            const prevPercentComplete = this.percentComplete

            this.percentComplete = Math.round(completeDuration / this.totalDuration * 100)

            if (prevPercentComplete !== this.percentComplete) {
               this.eventEmitter.emit("update")
            }

            console.log(`${outputFile} - ${this.percentComplete}% complete`)
         }
      }
   }

   convert = async (fileName: string, baseFilePath: string, mutex: Mutex) => {
      return await mutex.runExclusive(async () => {
         const outputFileName = `${fileName}.m4b`
         const outputFilePath = path.join(baseFilePath, outputFileName)
         const inputFilePath = path.join(baseFilePath, fileName)
         const encryptionKey = await this.crack(inputFilePath)

         if (!encryptionKey) {
            return
         }

         this.status = ConverterStatus.Converting

         const logFile = `${inputFilePath}.ffmpeg.log`
         const args = ["-activation_bytes", encryptionKey, "-i", `"${inputFilePath}"`, "-c", "copy", `"${outputFilePath}"`]
         const ffmpeg = spawn(ffmpegPath as any, args, { windowsVerbatimArguments: true, detached: false })

         ffmpeg.stdout.on("data", data => this.parseData(data, outputFilePath))
         ffmpeg.stderr.on("data", data => this.parseData(data, outputFilePath))

         ffmpeg.stderr.pipe(fs.createWriteStream(logFile))

         try {
            await onExit(ffmpeg)
         }
         catch {
            this.errorMessage = await fs.promises.readFile(logFile, "utf8")
            this.status = ConverterStatus.Error

            return
         }

         await fs.promises.unlink(logFile)
         await fs.promises.unlink(inputFilePath)

         const metadata = (await mm.parseFile(outputFilePath, { skipCovers: true, skipPostHeaders: true, includeChapters: false, }));

         if (metadata.common.title) {
            const sanitized = sanitize(metadata.common.title.replace(/:/gi, " - "))
            var desiredFilePath = path.join(baseFilePath, `${sanitized}.m4b`)

            if (fs.existsSync(desiredFilePath)) {
               desiredFilePath = path.join(baseFilePath, `${sanitized} - ${outputFileName}`)
            }

            await fs.promises.rename(outputFilePath, desiredFilePath)
         }

         this.status = ConverterStatus.Complete
      })
   }

   private crack = async (inputFilePath: string) => {
      this.status = ConverterStatus.Cracking

      const ffprobe = spawn(ffprobePath, [`"${inputFilePath}"`], { windowsVerbatimArguments: true, detached: false })
      var probeOutput = ""

      ffprobe.stdout.on("data", data => probeOutput += data.toString())
      ffprobe.stderr.on("data", data => probeOutput += data.toString())

      try {
         await onExit(ffprobe)
      }
      catch {
         this.errorMessage = probeOutput
         this.status = ConverterStatus.Error

         return "";
      }

      var matches = probeOutput.match(/file checksum == (.*)/)

      if (!matches) {
         this.errorMessage = `Couldn't find checksum from ffprobe

         ${probeOutput}`
         this.status = ConverterStatus.Error

         return "";
      }

      var cracker: ChildProcessWithoutNullStreams
      var crackerArgs = [".", "-h", matches[1]]
      var crackerOutput = ""

      if (process.platform === "win32") {
         cracker = spawn(path.join(__dirname, "inAudible-NG", "run", "rcrack.exe"), crackerArgs, { windowsVerbatimArguments: true, detached: false })
      }
      else {
         cracker = spawn(path.join(__dirname, "rcrack"), [".", "-h", matches[1]], { windowsVerbatimArguments: true, detached: false })
      }

      cracker.stdout.on("data", data => crackerOutput += data.toString())
      cracker.stderr.on("data", data => crackerOutput += data.toString())

      try {
         await onExit(cracker)
      }
      catch {
         this.errorMessage = crackerOutput
         this.status = ConverterStatus.Error

         return ""
      }

      var activationBytesMatches = crackerOutput.match(/hex\:(.*)/)

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

   durationToSeconds(matches: RegExpMatchArray) {
      var multiplier = 1;
      var seconds = 0;

      matches.reverse().forEach(m => {
         var num = parseInt(m)

         if (m && !isNaN(num)) {
            seconds += num * multiplier;
            multiplier *= 60
         }
      })

      return seconds;
   }
}

function onExit(childProcess: ChildProcess): Promise<void> {
   return new Promise((resolve, reject) => {
      childProcess.once('exit', (code: number, signal: string) => {
         if (code === 0) {
            resolve(undefined);
         } else {
            reject(new Error('Exit with error code: ' + code));
         }
      });
      childProcess.once('error', (err: Error) => {
         reject(err);
      });
   });
}