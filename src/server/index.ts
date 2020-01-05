import fastify, { FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import Directory from "../shared/Directory"
import Book, { Status } from "../shared/Book"
import * as mm from "music-metadata"
import sqlite from "sqlite"
import Settings from "../shared/Settings"
import { IncomingMessage, ServerResponse } from "http";
import send from "send"
import { PassThrough } from "readable-stream"
import User from "../shared/User"
import Unauthorized from "../shared/api/Unauthorized"
import AccessDenied from "../shared/api/AccessDenied"
import uuid from "uuid"
import bcrypt from "bcrypt"
import ServerToken from "./ServerToken"
import moment from "moment"
import stripHtml from "string-strip-html"
import mp3ToAac from "mp3-to-aac"
import { ItemType } from "../shared/ItemType";
import SettingsRequired from "../shared/api/SettingsRequired"
import { ApiMessageType } from "../shared/api/ApiMessage";
import SettingsUpdate from "../shared/api/SettingsUpdate"
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse"
import Books from "../shared/api/Books"
import UserListResponse from "../shared/api/UserListResponse"
import AddUserRequest from "../shared/api/AddUserRequest"
import DeleteUserRequest from "../shared/api/DeleteUserRequest"
import nodemailer from "nodemailer"
import url from "url"
import UserRequest from "../shared/api/UserRequest"
import UserResponse from "../shared/api/UserResponse"
import ChangePasswordRequest from "../shared/api/ChangePasswordRequest"
import ChangeBookStatusRequest from "../shared/api/ChangeBookStatusRequest";
import BookStatuses, { BookWithStatus } from "./BookStatuses"
import Token from "../shared/api/Token";
import { Mutex } from 'async-mutex';
import cookie from "cookie"
import fastifyMultipart from "fastify-multipart"
import pump from "pump"
import Converter from "./Converter"
import ConversionUpdateResponse from "../shared/api/ConversionUpdateResponse"
import UploadResponse from "../shared/api/UploadResponse"
import ConversionUpdateRequest from "../shared/api/ConversionUpdateRequest";
import { ConverterStatus } from "../shared/ConverterStatus"

const server = fastify({ logger: true, bodyLimit: 10_000_000_000 });
const settings = new Settings()
var noUsers = false;
var checksumSecret = "";
var authorizationExpiration = new Map<string, moment.Moment>()
var books = new Directory();
var rootDir = __dirname;
const tryParse = (text: string, reviver?: (this: any, key: string, value: any) => any) => {
   try {
      return JSON.parse(text, reviver)
   }
   catch {
      return undefined
   }
}
const getNewExpiration = () => moment().add(24, "hours")
const validateRequest = async (request: fastify.FastifyRequest<IncomingMessage, fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, any>, reply: fastify.FastifyReply<ServerResponse>, adminOnly?: boolean) => {
   const cookies = cookie.parse(request.headers["cookie"] || "") || {};
   const tokenJson = cookies.loginCookie ? new ServerToken(tryParse(cookies.loginCookie)) : undefined
   const token = new ServerToken(tokenJson)

   if (!tokenJson || !await token.isChecksumValid(checksumSecret)) {
      reply.code(401);

      return new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Please Log In" })
   }
   else if (adminOnly && !token.user.isAdmin) {
      reply.code(403)

      return new AccessDenied({ type: ApiMessageType.AccessDenied, message: "Access Denied" })
   }
   else {
      var expires = authorizationExpiration.has(token.authorization) ? authorizationExpiration.get(token.authorization) : undefined;

      if (!expires || expires < moment()) {
         reply.code(401)

         return new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Please Log In again" })
      }

      authorizationExpiration.set(token.authorization, getNewExpiration())

      return token;
   }
}
const createMailer = () => {
   return nodemailer.createTransport({
      service: "gmail",
      auth: {
         user: settings.inviteEmail,
         pass: settings.inviteEmailPassword,
      }
   })
}
var mailer = createMailer()
const changeBookStatusMutex = new Mutex()
var conversions = new Map<string, Converter>()
const conversionMutex = new Mutex();

server.register(fastifyMultipart, {
   limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 10_000_000_000, // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 10_000_000_000,      // For multipart forms, the max file size
      files: 1,           // Max number of file fields
      headerPairs: 2000   // Max number of header key=>value pairs
   }
})

sqlite.open("db.sqlite").then(async db => {
   const getAllUsers = async (message?: string) => {
      var users = await db.all("SELECT id, email, isAdmin, lastLogIn FROM user")

      return new UserListResponse({ users: users, type: ApiMessageType.UserListResponse, message: message || "" })
   }
   const validatePassword = async (email: string, password: string, reply: fastify.FastifyReply<ServerResponse>) => {
      var dbUser = await db.get("SELECT id, email, hash, isAdmin, lastLogIn FROM user WHERE email = ?", email)

      if (dbUser) {
         if (await bcrypt.compare(password, dbUser.hash)) {
            var validatedUser = new User(dbUser as User);
            var authorization = uuid.v4()

            validatedUser.lastLogin = new Date().getTime()
            authorizationExpiration.set(authorization, getNewExpiration())

            await db.run("UPDATE user SET lastLogIn = ? WHERE id = ?", validatedUser.lastLogin, validatedUser.id)

            return ServerToken.create(validatedUser, authorization, checksumSecret)
         }
      }

      reply.code(401)

      return new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Invalid Email or Password" })
   }
   const passwordHash = async (password: string) => {
      return await bcrypt.hash(password, 10)
   }
   const bookStatuses = async (userId: string) => {
      return new BookStatuses(JSON.parse((await db.get("SELECT bookStatuses FROM User WHERE id = ?", userId)).bookStatuses || "[]"))
   }
   const bookList = async (token: Token) => {
      var dir = new Directory(books);

      dir.id = "root"

      UpdateUrlsAndStatus(dir, token.authorization, token.user.id, await bookStatuses(token.user.id));

      return new Books({ type: ApiMessageType.Books, directory: dir })
   }

   await db.exec(`
      CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT, hash TEXT, isAdmin BOOLEAN, lastLogin BIGINT, bookStatuses TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS IX_user_email ON user (email);
   `)

   await db.exec("PRAGMA user_version = 1");

   (await db.all("SELECT key, value FROM setting")).forEach((row: { key: string, value: string }) => {
      switch (row.key) {
         case "baseBooksPath": {
            settings.baseBooksPath = row.value
            break;
         }
         case "checksumSecret": {
            checksumSecret = row.value;
            break;
         }
         case "inviteEmail": {
            settings.inviteEmail = row.value
            break;
         }
         case "inviteEmailPassword": {
            settings.inviteEmailPassword = row.value
            break;
         }
         case "uploadLocation": {
            settings.uploadLocation = row.value
            break
         }
      }
   })

   if (!checksumSecret) {
      checksumSecret = uuid.v4()

      console.log("Creating checksum secret")

      await db.run("INSERT INTO setting (key, value) VALUES('checksumSecret', ?)", checksumSecret)
   }

   noUsers = (await db.get("SELECT COUNT(1) as userCount FROM user")).userCount == 0

   if (noUsers) {
      console.warn("Currently there are no users in the database so the first login attempt will create a user")
   }

   if (settings.baseBooksPath) {
      console.log("Loading all books into memory")
      try {
         books = await Recursive([], "")
      }
      catch {

      }
      console.log(`${books.bookCount()} Books loaded, starting website`)
   }

   if (settings.inviteEmail && settings.inviteEmailPassword) {
      mailer = createMailer()
   }

   while (!fs.existsSync(path.join(rootDir, "package.json"))) {
      rootDir = path.join(rootDir, "../")
   }

   server.post("/auth", async (request, reply) => {
      var user = new User(request.body)

      if (noUsers) {
         noUsers = false;
         console.warn(`Adding user ${user.email} to the database since they are the first login attempt`)

         const hash = await passwordHash(user.password)

         await db.run("INSERT INTO user (id, email, hash, isAdmin) VALUES(?, ?, ?, ?)", uuid.v4(), user.email, hash, 1)
      }

      return await validatePassword(user.email, user.password, reply)
   })

   server.post("/books", async (request, reply) => {
      var token = await validateRequest(request, reply);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      if (!settings.baseBooksPath || !settings.inviteEmail || !settings.inviteEmailPassword || !settings.uploadLocation) {
         if (token.user.isAdmin) {
            return new SettingsRequired({ type: ApiMessageType.SettingsRequired, message: "You must specify a setting", settings: settings })
         }
         else {
            return new AccessDenied({ type: ApiMessageType.AccessDenied, message: "Some settings are missing, but they must be specified by an administrator" })
         }
      }

      return await bookList(token)
   })

   server.post("/settings", async (request, reply) => {
      var token = await validateRequest(request, reply, true);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      return new SettingsRequired({ type: ApiMessageType.SettingsRequired, settings: settings, message: "" });
   })

   server.post("/updateSettings", async (request, reply) => {
      var settingsUpdate = new SettingsUpdate(request.body)
      var inviteChanged = false;
      var messages = new Array<string>();
      var token = await validateRequest(request, reply, true);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      if (settingsUpdate.settings.inviteEmail !== settings.inviteEmail) {
         settings.inviteEmail = settingsUpdate.settings.inviteEmail

         await db.run("REPLACE INTO setting (key, value) VALUES('inviteEmail', ?)", settings.inviteEmail)
         inviteChanged = true
         messages.push("Invite email updated")
      }

      if (settingsUpdate.settings.inviteEmailPassword !== settings.inviteEmailPassword) {
         settings.inviteEmailPassword = settingsUpdate.settings.inviteEmailPassword

         await db.run("REPLACE INTO setting (key, value) VALUES('inviteEmailPassword', ?)", settings.inviteEmailPassword)
         inviteChanged = true
         messages.push("Invite email password updated")
      }

      if (settingsUpdate.settings.uploadLocation !== settings.uploadLocation) {
         settings.uploadLocation = settingsUpdate.settings.uploadLocation

         await db.run("REPLACE INTO setting (key, value) VALUES('uploadLocation', ?)", settings.uploadLocation)
         messages.push("Upload location updated")
      }

      if (inviteChanged) {
         mailer = createMailer()
      }

      if (settingsUpdate.settings.baseBooksPath !== settings.baseBooksPath) {
         if (!fs.existsSync(settingsUpdate.settings.baseBooksPath)) {
            return new SettingsUpdateResponse({ type: ApiMessageType.SettingsUpdateResponse, message: `Path "${settingsUpdate.settings.baseBooksPath}" does not exist`, successful: false })
         }

         settings.baseBooksPath = settingsUpdate.settings.baseBooksPath

         await db.run("REPLACE INTO setting (key, value) VALUES('baseBooksPath', ?)", settings.baseBooksPath)

         console.log("Loading all books into memory because of a settings change")
         books = await Recursive([], "")
         console.log(`${books.bookCount()} Books loaded`)

         messages.push(`Loaded ${books.bookCount()} books`)
      }

      return new SettingsUpdateResponse({ type: ApiMessageType.SettingsUpdateResponse, message: messages.length ? messages.join(".") : "No changes", successful: true })
   })

   server.post("/users", async (request, reply) => {
      var token = await validateRequest(request, reply, true);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      return await getAllUsers()
   })

   server.post("/addUser", async (request, reply) => {
      var userRequest = new AddUserRequest(request.body)
      var token = await validateRequest(request, reply, true);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      var message = `${userRequest.user.email} has been invited`

      if (!userRequest.user.email) {
         message = "Email must be specified"
      }
      else {
         if (await db.get("SELECT id FROM User where email = ?", userRequest.user.email)) {
            message = "User already exists"
         }
         else {
            var userId = uuid.v4()

            await db.run("INSERT INTO User (id, email, isAdmin) VALUES(?, ?, ?)", userId, userRequest.user.email, userRequest.user.isAdmin)

            var link = url.resolve(request.headers.referer, `/invite/${userId}`);

            mailer.sendMail({
               from: settings.inviteEmail,
               to: userRequest.user.email,
               subject: "Invite to Audio Books Website",
               html: `
                  You have been invited to the audio books website.<br /><br />
                  You can sign up at: <a href="${link}">${link}</a>.
               `
            })
         }
      }

      return await getAllUsers(message)
   })

   server.post("/deleteUser", async (request, reply) => {
      var userRequest = new DeleteUserRequest(request.body)
      var token = await validateRequest(request, reply, true);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      await db.run("DELETE FROM User WHERE id = ?", userRequest.userId)

      return await getAllUsers("User deleted")
   })

   server.post("/user", async (request, reply) => {
      var userRequest = new UserRequest(request.body)

      var dbUser = await db.get("SELECT id, email, hash, isAdmin, lastLogin FROM User WHERE id = ?", [userRequest.userId])

      if (dbUser.lastLogin || dbUser.hash) {
         reply.code(403)

         return new AccessDenied({ message: "This user has logged in or has a password already set", type: ApiMessageType.AccessDenied })
      }
      else {
         return new UserResponse({ user: new User(dbUser), type: ApiMessageType.UserResponse })
      }
   })

   server.post("/changePassword", async (request, reply) => {
      var changeRequest = new ChangePasswordRequest(request.body)

      if (changeRequest.token.authorization) {
         //This is a change password request for someone that's already logged in
         var token = await validateRequest(request, reply);

         if (!(token instanceof ServerToken)) {
            return token;
         }
      }
      else {
         //This is a change password request for someone that's never logged in
         var dbUser = await db.get("SELECT hash, lastLogin FROM User WHERE id = ?", [changeRequest.token.user.id])

         if (dbUser.lastLogin || dbUser.hash) {
            reply.code(403)

            return new AccessDenied({ message: "This user has logged in or has a password already set", type: ApiMessageType.AccessDenied })
         }
      }

      var hash = await passwordHash(changeRequest.newPassword)

      await db.run("UPDATE User SET hash = ? WHERE id = ?", hash, changeRequest.token.user.id)

      return await validatePassword(changeRequest.token.user.email, changeRequest.newPassword, reply)
   })

   server.post("/changeBookStatus", async (request, reply) => {
      var statusRequest = new ChangeBookStatusRequest(request.body)
      var token = await validateRequest(request, reply);

      if (!(token instanceof ServerToken)) {
         return token;
      }

      const release = await changeBookStatusMutex.acquire()

      try {
         var statuses = await bookStatuses(statusRequest.token.user.id)

         statuses.set(statusRequest.bookId, new BookWithStatus({ status: statusRequest.status, dateStatusSet: new Date().getTime() }))

         await db.run("UPDATE User SET bookStatuses = ? WHERE id = ?", JSON.stringify(statuses), statusRequest.token.user.id)
      }
      finally {
         release()
      }

      return await bookList(statusRequest.token)
   })

   server.post("/upload", (request, reply) => {
      validateRequest(request, reply).then(token => {
         if (!(token instanceof ServerToken)) {
            reply.send(token)
            return;
         }

         const id = uuid.v4()
         const mp = request.multipart(handler, onEnd)
         var fileName = ""
         var filePath = ""

         mp.on('field', function (key: any, value: any) {
            if (key === "fileName") {
               var parts = (value as string).split(".")

               fileName = `${id}.${parts[parts.length - 1]}`
               filePath = path.join(settings.uploadLocation, fileName)
            }
         })

         function onEnd(err: Error) {
            var conversion = new Converter();

            conversions.set(id, conversion)

            conversion.convert(fileName, settings.uploadLocation, conversionMutex).then(() => {
               setTimeout(() => conversions.delete(id), 60000)
            })

            reply.code(200).send(new UploadResponse({ type: ApiMessageType.UploadResponse, conversionId: id }))
         }

         function handler(field: string, file: any, filename: string, encoding: string, mimetype: string) {
            pump(file, fs.createWriteStream(filePath))
         }
      })
   })

   server.post("/conversionUpdate", async (request, reply) => {
      var updateRequest = new ConversionUpdateRequest(request.body)
      var token = await validateRequest(request, reply);
      var conversion = conversions.get(updateRequest.conversionId)
      var response = { conversionPercent: 100, errorMessage: "", converterStatus: ConverterStatus.Complete }

      if (!(token instanceof ServerToken)) {
         return token;
      }

      if (conversion) {
         if (conversion.status !== ConverterStatus.Error) {
            await conversion.waitForUpdate(updateRequest.knownPercent, updateRequest.knownConverterStatus)
         }

         response = { conversionPercent: conversion.percentComplete, errorMessage: conversion.errorMessage, converterStatus: conversion.status }
      }

      return new ConversionUpdateResponse({ ...response, type: ApiMessageType.ConversionUpdateResponse })
   })

   server.get("/files/*", (request, reply) => {
      validateRequest(request, reply).then(token => {
         var filePath = request.params["*"] as string;

         if (!(token instanceof ServerToken)) {
            reply.send(token)
         }
         else if (filePath.endsWith(".jpg")) {
            reply.header("Cache-control", `public, max-age=${30 * 24 * 60 * 60}`)
            sendFile(request, reply, settings.baseBooksPath, filePath)
         }
         else if (filePath.endsWith(".m4b") || filePath.endsWith(".mp3")) {
            var splitPath = filePath.split("/");

            reply.header("Content-Disposition", `attachment; filename=\"${splitPath[splitPath.length - 1]}\"`)

            sendFile(request, reply, settings.baseBooksPath, filePath)
         }
         else {
            reply.code(404).send("Not Found");
         }
      })
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
}

async function Recursive(pathTree: string[], name: string): Promise<Directory | null> {
   var currPath = path.join(settings.baseBooksPath, ...pathTree, name)
   var paths = await fs.promises.readdir(currPath, { withFileTypes: true });
   var newPathTree = name ? pathTree.concat(name) : pathTree;
   var dir = new Directory();

   dir.name = name;
   dir.id = newPathTree.join("/")

   for (const p of paths) {
      if (p.isDirectory()) {
         var result = await Recursive(newPathTree, p.name);

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