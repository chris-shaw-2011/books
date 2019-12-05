import fastify, { FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import Directory from "../shared/Directory"
import Book from "../shared/Book"
import * as mm from "music-metadata"
import sqlite from "sqlite"
import Settings from "./Settings"
import { IncomingMessage, ServerResponse } from "http";
import send from "send"
import { PassThrough } from "readable-stream"
import User from "../shared/User"
import Unauthorized from "../shared/Unauthorized"
import uuid from "uuid"
import bcrypt from "bcrypt"
import ServerToken from "./ServerToken"
import moment from "moment"
import stripHtml from "string-strip-html"
import mp3ToAac from "mp3-to-aac"
import { ItemType } from "../shared/ItemType";

const server = fastify({ logger: true });
const settings = new Settings()
var noUsers = false;
var checksumSecret = "";
var authorizationExpiration = new Map<string, moment.Moment>()
var books = new Directory();
var rootDir = __dirname;
const getNewExpiration = () => moment().add(24, "hours")
const validateAuthorization = (authorization: string, reply: fastify.FastifyReply<ServerResponse>) => {
   var expires = authorizationExpiration.has(authorization) ? authorizationExpiration.get(authorization) : undefined;

   if (!expires || expires < moment()) {
      reply.code(401)

      return new Unauthorized({ message: "Please Log In again" })
   }

   authorizationExpiration.set(authorization, getNewExpiration())
   return true;
}
const validateRequest = async (token: ServerToken, reply: fastify.FastifyReply<ServerResponse>) => {
   if (!await token.isChecksumValid(checksumSecret)) {
      reply.code(401);

      return new Unauthorized({ message: "Please Log In" })
   }
   else {
      return validateAuthorization(token.authorization, reply)
   }
}

sqlite.open("db.sqlite").then(async db => {
   await db.exec(`
      CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT, hash TEXT, isAdmin BOOLEAN);
      CREATE UNIQUE INDEX IF NOT EXISTS IX_user_email ON user (email);
   `)

   await db.exec("PRAGMA user_version = 1");

   (await db.all("SELECT key, value FROM setting")).forEach((row: { key: string, value: string }) => {
      switch (row.key) {
         case "baseBooksPath": {
            settings.baseBooksPath = row.value
         }
         case "checksumSecret": {
            checksumSecret = row.value;
         }
      }
   })

   settings.baseBooksPath = "T:\\Audio Books\\"

   if (!checksumSecret) {
      checksumSecret = uuid.v4()

      console.log("Creating checksum secret")

      await db.run("INSERT INTO setting (key, value) VALUES('checksumSecret', ?)", checksumSecret)
   }

   noUsers = (await db.get("SELECT COUNT(1) as userCount FROM user")).userCount == 0

   if (noUsers) {
      console.warn("Currently there are no users in the database so the first login attempt will create a user")
   }

   console.log("Loading all books into memory")
   books = await Recursive([], "")
   console.log("Books loaded, starting website")

   while (!fs.existsSync(path.join(rootDir, "package.json"))) {
      rootDir = path.join(rootDir, "../")
   }

   console.log(`Root directory is ${rootDir}`)

   server.post("/auth", async (request, reply) => {
      var user = new User(request.body)

      if (noUsers) {
         noUsers = false;
         console.warn(`Adding user ${user.email} to the database since they are the first login attempt`)

         const hash = await bcrypt.hash(user.password, 10)

         await db.run("INSERT INTO user (id, email, hash, isAdmin) VALUES(?, ?, ?, ?)", uuid.v4(), user.email, hash, 1)
      }

      var dbUser = await db.get("SELECT id, email, hash, isAdmin FROM user WHERE email = ?", user.email)

      if (dbUser) {
         if (await bcrypt.compare(user.password, dbUser.hash)) {
            var validatedUser = new User(dbUser as User);
            var authorization = uuid.v4()

            authorizationExpiration.set(authorization, getNewExpiration())

            return ServerToken.create(validatedUser, authorization, checksumSecret)
         }
      }

      reply.code(401)

      return new Unauthorized({ message: "Invalid Email or Password" })
   })

   server.post("/books", async (request, reply) => {
      var token = new ServerToken(request.body)
      var reqValidation = await validateRequest(token, reply);

      if (reqValidation !== true) {
         return reqValidation;
      }

      var dir = new Directory(books);

      UpdateUrls(dir, token.authorization);

      return dir;
   })

   server.get("/files/:authorization/*", (request, reply) => {
      var filePath = request.params["*"] as string;
      var authValidation = validateAuthorization(request.params.authorization as string, reply)

      if (authValidation === true && filePath.endsWith(".jpg") || filePath.endsWith(".m4b")) {
         if (filePath.endsWith(".m4b")) {
            var splitPath = filePath.split("/");

            reply.header("Content-Disposition", `attachment; filename=\"${splitPath[splitPath.length - 1]}\"`)
         }

         sendFile(request, reply, settings.baseBooksPath, filePath)
      }
      else {
         reply.code(404).send("Not Found");
      }
   })

   //This handles requests to the root of the site in production
   server.get("/*", (request, reply) => {
      var filePath = request.params["*"] as string || "index.html"

      sendFile(request, reply, path.join(rootDir, "build"), filePath)
   })

   const start = async () => {
      try {
         await server.listen(3001, "::")
      }
      catch (err) {
         server.log.error(err)
         process.exit(1)
      }
   }

   start();
})

function UpdateUrls(dir: Directory, authorization: string) {
   for (const i of dir.items) {
      if (i.type == ItemType.book) {
         i.download = i.download.replace("{authorization}", authorization)
         i.cover = i.cover.replace("{authorization}", authorization)
      }
      else {
         UpdateUrls(i, authorization)
      }
   }
}

async function Recursive(pathTree: string[], name: string): Promise<Directory | null> {
   var currPath = path.join(settings.baseBooksPath, ...pathTree, name)
   var paths = await fs.promises.readdir(currPath, { withFileTypes: true });
   var newPathTree = name ? pathTree.concat(name) : pathTree;
   var dir = new Directory();

   dir.name = name;

   for (const p of paths) {
      if (p.isDirectory()) {
         var result = await Recursive(newPathTree, p.name);

         if (result) {
            dir.items.push(result)
         }
      }
      else if (p.isFile() && p.name.endsWith(".m4b")) {
         var book = new Book();
         var bookPath = path.join(currPath, p.name);
         var photoPath = bookPath + ".jpg"

         console.log(`${bookPath} - reading tags`)

         const metadata = (await mm.parseFile(bookPath));
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

         if (newPathTree.length) {
            book.download = `/files/{authorization}/${newPathTree.join("/")}/${p.name}`
         }
         else {
            book.download = `/files/{authorization}/${p.name}`
         }

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

//Function copied from fastify-static
function sendFile(request: fastify.FastifyRequest<IncomingMessage, fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, any>, reply: FastifyReply<ServerResponse>, root: string, path: string) {
   const stream = send(request.raw, path, { root: root })
   var resolvedFilename: string;
   var finished = false;

   stream.on('file', function (file) {
      resolvedFilename = file
   })

   const wrap = new PassThrough({
      flush(cb) {
         if (reply.res.statusCode === 304) {
            reply.send('')
         }
         cb(undefined, undefined)
      }
   })
   const getHeader = reply.getHeader.bind(reply);
   const setHeader = reply.header.bind(reply);
   const socket = request.raw.socket;

   Object.defineProperty(wrap, "getHeader", {
      get() {
         return getHeader
      }
   })
   Object.defineProperty(wrap, "setHeader", {
      get() {
         return setHeader
      }
   })
   Object.defineProperty(wrap, "socket", {
      get() {
         return socket;
      }
   })
   Object.defineProperty(wrap, "finished", {
      get() {
         return finished
      },
      set(value: boolean) {
         finished = value;
      }
   })
   Object.defineProperty(wrap, 'filename', {
      get() {
         return resolvedFilename
      }
   })
   Object.defineProperty(wrap, 'statusCode', {
      get() {
         return reply.res.statusCode
      },
      set(code) {
         reply.code(code)
      }
   })

   wrap.on('pipe', function () {
      reply.send(wrap)
   })

   stream.on('error', function (err) {
      if (err) {
         if (err.code === 'ENOENT') {
            return reply.callNotFound()
         }
         reply.send(err)
      }
   })

   // we cannot use pump, because send error
   // handling is not compatible
   stream.pipe(wrap)
}

async function convertMp3s(currPath: string) {
   console.log(`Checking Folder ${currPath}`)

   var paths = await fs.promises.readdir(currPath, { withFileTypes: true });
   var mp3s = new Array<string>()
   var hasM4b = false;
   var bestCover = ""
   var bestCoverSize = 0;
   var outputName = ""

   for (const p of paths) {
      if (p.isDirectory()) {
         await convertMp3s(path.join(currPath, p.name))
      }
      else if (p.isFile()) {
         if (p.name.toLowerCase().endsWith(".mp3")) {
            mp3s.push(p.name)

            if (!outputName) {
               outputName = p.name.replace("-Part00.mp3", "").replace("-Part01.mp3", "")
            }
         }
         else if (p.name.toLowerCase().endsWith("m4b")) {
            hasM4b = true;
         }
         else if (p.name.toLowerCase().endsWith("jpg")) {
            var size = (await fs.promises.stat(path.join(currPath, p.name))).size

            if (size > bestCoverSize) {
               bestCover = p.name
               bestCoverSize = size
            }
         }
      }
   }

   if (!hasM4b && mp3s.length) {
      await mp3ToAac(mp3s, `${outputName}.m4b`, {
         cwd: currPath,
         debug: true,
         metaDataOverrides: {
            title: outputName,
            coverPicturePath: bestCover,
         },
      })
   }
}