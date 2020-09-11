import { Mutex } from "async-mutex"
import bcrypt from "bcrypt"
import cookie from "cookie"
import fastify, { FastifyRequest, FastifyReply } from "fastify"
import fastifyMultipart from "fastify-multipart"
import fastifyStatic from "fastify-static"
import fs from "fs"
import moment from "moment"
import path from "path"
import util from "util"
import { pipeline } from "stream"
import url from "url"
import { v4 as uuid } from "uuid"
import AccessDenied from "../shared/api/AccessDenied"
import AddUserRequest from "../shared/api/AddUserRequest"
import { ApiMessageType } from "../shared/api/ApiMessage"
import Books from "../shared/api/Books"
import ChangeBookStatusRequest from "../shared/api/ChangeBookStatusRequest"
import ChangePasswordRequest from "../shared/api/ChangePasswordRequest"
import ConversionUpdateRequest from "../shared/api/ConversionUpdateRequest"
import ConversionUpdateResponse from "../shared/api/ConversionUpdateResponse"
import DeleteUserRequest from "../shared/api/DeleteUserRequest"
import SettingsRequired from "../shared/api/SettingsRequired"
import SettingsUpdate from "../shared/api/SettingsUpdate"
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse"
import Unauthorized from "../shared/api/Unauthorized"
import UploadResponse from "../shared/api/UploadResponse"
import UserListResponse from "../shared/api/UserListResponse"
import UserRequest from "../shared/api/UserRequest"
import UserResponse from "../shared/api/UserResponse"
import Book, { Status } from "../shared/Book"
import BookStatuses from "../shared/BookStatuses"
import BookWithStatus from "../shared/BookWithStatus"
import { ConverterStatus } from "../shared/ConverterStatus"
import User from "../shared/User"
import bookList from "./BookList"
import Converter from "./Converter"
import db from "./Database"
import ServerToken from "./ServerToken"
import UpdateBookRequest from "../shared/api/UpdateBookRequest"
import NodeID3 from "node-id3"
import UpdateBookResponse from "../shared/api/UpdateBookResponse"
import sanitize from "sanitize-filename"
import ServerBook from "./ServerBook"

const pump = util.promisify(pipeline)
const authorizationExpiration = new Map<string, moment.Moment>()
let rootDir = __dirname
const tryParse = (text: string, reviver?: (this: any, key: string, value: any) => any) => {
   try {
      return JSON.parse(text, reviver)
   }
   catch {
      return undefined
   }
}
const getNewExpiration = () => moment().add(24, "hours")
const changeBookStatusMutex = new Mutex()
const conversions = new Map<string, Converter>()
const conversionMutex = new Mutex()
const server = fastify({ logger: true, bodyLimit: 10_000_000_000 })
const getAllUsers = async (message?: string) => {
   const users = await db.all("SELECT id, email, isAdmin, lastLogIn FROM user")

   return new UserListResponse({ users, type: ApiMessageType.UserListResponse, message: message || "" })
}
const validatePassword = async (email: string, password: string, reply: FastifyReply) => {
   const dbUser = await db.get("SELECT id, email, hash, isAdmin, lastLogIn FROM user WHERE email = ?", email)

   if (dbUser) {
      if (await bcrypt.compare(password, dbUser.hash)) {
         const validatedUser = new User(dbUser as User)
         const authorization = uuid()

         validatedUser.lastLogin = new Date().getTime()
         authorizationExpiration.set(authorization, getNewExpiration())

         await db.run("UPDATE user SET lastLogIn = ? WHERE id = ?", validatedUser.lastLogin, validatedUser.id)

         return ServerToken.create(validatedUser, authorization, db.settings.checksumSecret)
      }
   }

   reply.code(401)

   return new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Invalid Email or Password" })
}
const passwordHash = async (password: string) => {
   return await bcrypt.hash(password, 10)
}
const requestToken = (request: FastifyRequest) => {
   const cookies = cookie.parse(request.headers.cookie || "") || {}
   const tokenJson = cookies.loginCookie ? new ServerToken(tryParse(cookies.loginCookie)) : undefined

   return new ServerToken(tokenJson)
}
const validateRequest = async (request: FastifyRequest, reply: FastifyReply) => {
   const token = requestToken(request)

   if (!token.user.id || !await token.isChecksumValid(db.settings.checksumSecret)) {
      reply.code(401).send(new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Please Log In" }))
   }
   else {
      const expires = authorizationExpiration.has(token.authorization) ? authorizationExpiration.get(token.authorization) : undefined

      if (!expires || expires < moment()) {
         reply.code(401).send(new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Please Log In again" }))

         return
      }

      authorizationExpiration.set(token.authorization, getNewExpiration())

      return token
   }
}
const validateAdminRequest = async (request: FastifyRequest, reply: FastifyReply) => {
   const resp = await validateRequest(request, reply)

   if (resp instanceof ServerToken && !resp.user.isAdmin) {
      reply.code(403).send(new AccessDenied({ type: ApiMessageType.AccessDenied, message: "Access Denied" }))
   }
}
const statusesForUser = async (userId: string) => {
   const json = (await db.get("SELECT bookStatuses FROM User WHERE id = ?", userId)).bookStatuses

   return new BookStatuses(json ? JSON.parse(json) : undefined)
}

while (!fs.existsSync(path.join(rootDir, "package.json"))) {
   rootDir = path.join(rootDir, "../")
}

server.register(fastifyMultipart, {
   limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 10_000_000_000, // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 10_000_000_000,      // For multipart forms, the max file size
      files: 1,           // Max number of file fields
      headerPairs: 2000,   // Max number of header key=>value pairs
   },
})

server.register(fastifyStatic, {
   root: rootDir,
   prefix: "/unused/",
})

server.post<{ Body: User }>("/auth", async (request, reply) => {
   const user = new User(request.body)

   if (!user.password) {
      return new Unauthorized({ message: "You must specify a password", type: ApiMessageType.Unauthorized })
   }

   if (db.noUsers) {
      db.noUsers = false
      console.warn(`Adding user ${user.email} to the database since they are the first login attempt`)

      const hash = await passwordHash(user.password)

      await db.run("INSERT INTO user (id, email, hash, isAdmin) VALUES(?, ?, ?, ?)", uuid(), user.email, hash, 1)
   }

   return await validatePassword(user.email, user.password, reply)
})

server.post("/books", { preHandler: validateRequest }, async (request, reply) => {
   const token = requestToken(request)

   if (!db.settings.baseBooksPath || !db.settings.inviteEmail || !db.settings.inviteEmailPassword || !db.settings.uploadLocation) {
      if (token.user.isAdmin) {
         return new SettingsRequired({ type: ApiMessageType.SettingsRequired, message: "You must specify a setting", settings: db.settings })
      }
      else {
         return new AccessDenied({ type: ApiMessageType.AccessDenied, message: "Some settings are missing, but they must be specified by an administrator" })
      }
   }

   const books = await bookList.allBooks()
   const statuses = await statusesForUser(token.user.id)

   return new Books({ type: ApiMessageType.Books, directory: books, bookStatuses: statuses })
})

server.post("/settings", { preHandler: validateAdminRequest }, (request, reply) => {
   reply.send(new SettingsRequired({ type: ApiMessageType.SettingsRequired, settings: db.settings, message: "" }))
})

server.post<{ Body: SettingsUpdate }>("/updateSettings", { preHandler: validateAdminRequest }, (request, reply) => {
   const settingsUpdate = new SettingsUpdate(request.body)

   db.settings.inviteEmail = settingsUpdate.settings.inviteEmail
   db.settings.inviteEmailPassword = settingsUpdate.settings.inviteEmailPassword
   db.settings.uploadLocation = settingsUpdate.settings.uploadLocation

   if (settingsUpdate.settings.baseBooksPath !== db.settings.baseBooksPath) {
      if (!fs.existsSync(settingsUpdate.settings.baseBooksPath)) {
         reply.send(new SettingsUpdateResponse({ type: ApiMessageType.SettingsUpdateResponse, message: `Path "${settingsUpdate.settings.baseBooksPath}" does not exist`, successful: false }))
      }

      db.settings.baseBooksPath = settingsUpdate.settings.baseBooksPath

      // tslint:disable-next-line: no-console
      console.log("Loading all books into memory because of a settings change")
      bookList.loadBooks()
   }

   reply.send(new SettingsUpdateResponse({ type: ApiMessageType.SettingsUpdateResponse, message: "", successful: true }))
})

server.post("/users", { preHandler: validateAdminRequest }, async (request, reply) => {
   return await getAllUsers()
})

server.post<{ Body: AddUserRequest }>("/addUser", { preHandler: validateAdminRequest }, async (request, reply) => {
   const userRequest = new AddUserRequest(request.body)
   let message = `${userRequest.user.email} has been invited`

   if (!userRequest.user.email) {
      message = "Email must be specified"
   }
   else {
      if (await db.get("SELECT id FROM User where email = ?", userRequest.user.email)) {
         message = "User already exists"
      }
      else {
         const userId = uuid()

         await db.run("INSERT INTO User (id, email, isAdmin) VALUES(?, ?, ?)", userId, userRequest.user.email, userRequest.user.isAdmin)

         const link = url.resolve(request.headers.referer!, `/invite/${userId}`)

         db.settings.mailer.sendMail({
            from: db.settings.inviteEmail,
            to: userRequest.user.email,
            subject: "Invite to Audio Books Website",
            html: `
            You have been invited to the audio books website.<br /><br />
            You can sign up at: <a href="${link}">${link}</a>.
         `,
         })
      }
   }

   return await getAllUsers(message)
})

server.post<{ Body: DeleteUserRequest }>("/deleteUser", { preHandler: validateAdminRequest }, async (request, reply) => {
   const userRequest = new DeleteUserRequest(request.body)

   await db.run("DELETE FROM User WHERE id = ?", userRequest.userId)

   return await getAllUsers("User deleted")
})

server.post<{ Body: UserRequest }>("/user", async (request, reply) => {
   const userRequest = new UserRequest(request.body)

   const dbUser = await db.get("SELECT id, email, hash, isAdmin, lastLogin FROM User WHERE id = ?", userRequest.userId)

   if (dbUser.lastLogin || dbUser.hash) {
      reply.code(403)

      return new AccessDenied({ message: "This user has logged in or has a password already set", type: ApiMessageType.AccessDenied })
   }
   else {
      return new UserResponse({ user: new User(dbUser), type: ApiMessageType.UserResponse })
   }
})

server.post<{ Body: ChangePasswordRequest }>("/changePassword", async (request, reply) => {
   const changeRequest = new ChangePasswordRequest(request.body)

   if (changeRequest.token.authorization) {
      // This is a change password request for someone that's already logged in
      const token = await validateRequest(request, reply)

      if (!(token instanceof ServerToken)) {
         return token
      }
   }
   else {
      // This is a change password request for someone that's never logged in
      const dbUser = await db.get("SELECT hash, lastLogin FROM User WHERE id = ?", changeRequest.token.user.id)

      if (dbUser.lastLogin || dbUser.hash) {
         reply.code(403)

         return new AccessDenied({ message: "This user has logged in or has a password already set", type: ApiMessageType.AccessDenied })
      }
   }

   const hash = await passwordHash(changeRequest.newPassword)

   await db.run("UPDATE User SET hash = ? WHERE id = ?", hash, changeRequest.token.user.id)

   return await validatePassword(changeRequest.token.user.email, changeRequest.newPassword, reply)
})

server.post<{ Body: ChangeBookStatusRequest }>("/changeBookStatus", { preHandler: validateRequest }, async (request, reply) => {
   const statusRequest = new ChangeBookStatusRequest(request.body)
   const release = await changeBookStatusMutex.acquire()
   let statuses: BookStatuses

   try {
      statuses = await statusesForUser(statusRequest.token.user.id)

      if (statusRequest.status !== Status.Unread) {
         statuses[statusRequest.bookId] = new BookWithStatus({ status: statusRequest.status, dateStatusSet: new Date().getTime() })
      }
      else {
         delete statuses[statusRequest.bookId]
      }

      await db.run("UPDATE User SET bookStatuses = ? WHERE id = ?", JSON.stringify(statuses), statusRequest.token.user.id)
   }
   finally {
      release()
   }

   const books = await bookList.allBooks()

   return new Books({ type: ApiMessageType.Books, directory: books, bookStatuses: statuses })
})

server.post("/upload", { preHandler: validateRequest }, async (request, reply) => {
   const id = uuid()
   const file = await request.file()
   const fileName = `${id}${path.extname(file.filename)}`
   const filePath = path.join(db.settings.uploadLocation, fileName)
   const conversion = new Converter()

   await pump(file.file, fs.createWriteStream(filePath))

   conversions.set(id, conversion)

   // Start the conversion in the background
   conversion.convert(fileName, db.settings.uploadLocation, conversionMutex, rootDir).then(() => {
      setTimeout(() => conversions.delete(id), 60000)
   })

   reply.code(200).send(new UploadResponse({ type: ApiMessageType.UploadResponse, conversionId: id }))
})

server.post<{ Body: ConversionUpdateRequest }>("/conversionUpdate", { preHandler: validateRequest }, async (request, reply) => {
   const updateRequest = new ConversionUpdateRequest(request.body)
   const conversion = conversions.get(updateRequest.conversionId)
   let book: ServerBook | undefined
   let response = { conversionPercent: 100, errorMessage: "", converterStatus: ConverterStatus.Complete }

   if (conversion) {
      if (conversion.status !== ConverterStatus.Error) {
         await conversion.waitForUpdate(updateRequest.knownPercent, updateRequest.knownConverterStatus)
      }

      response = { conversionPercent: conversion.percentComplete, errorMessage: conversion.errorMessage, converterStatus: conversion.status }

      if (conversion.status === ConverterStatus.Complete) {
         book = bookList.findBookByPath(conversion.convertedFilePath) as ServerBook
      }
   }

   return new ConversionUpdateResponse({ ...response, type: ApiMessageType.ConversionUpdateResponse, book })
})

server.post<{ Body: UpdateBookRequest }>("/updateBook", { preHandler: validateAdminRequest }, async request => {
   const updateBookRequest = new UpdateBookRequest(request.body)
   const book = (await bookList.allBooks()).findById(updateBookRequest.newBook.id)

   if (book instanceof Book) {
      const newPath = path.join(path.dirname(book.fullPath), `${sanitize(updateBookRequest.newBook.name.replace(/:/gi, " - "))}.mp3`)

      // Check to see if the file needs renamed
      if (book.fullPath !== newPath) {
         if (fs.existsSync(newPath)) {
            return new UpdateBookResponse({ type: ApiMessageType.UpdateBookResponse, message: `File ${newPath} already exists` })
         }

         // tslint:disable-next-line: no-console
         console.log(`Renaming ${book.fullPath} to ${newPath}`)

         await fs.promises.rename(book.fullPath, newPath)

         if (fs.existsSync(book.photoPath)) {
            await fs.promises.unlink(book.photoPath)
         }

         bookList.deleteBook(book.fullPath)
      }

      NodeID3.update({ title: updateBookRequest.newBook.name, artist: updateBookRequest.newBook.author, year: updateBookRequest.newBook.year, comment: { language: "eng", text: updateBookRequest.newBook.comment }, composer: updateBookRequest.newBook.narrator, genre: updateBookRequest.newBook.genre }, newPath)

      if (book.fullPath !== newPath) {
         await bookList.fileAdded(newPath)

         const newBook = bookList.findBookByPath(newPath)

         if (newBook) {
            await db.run("UPDATE user SET bookStatuses = REPLACE(bookStatuses, ?, ?) WHERE bookStatuses LIKE ?", `${JSON.stringify(book.id)}`, `${JSON.stringify(newBook.id)}`, `%${JSON.stringify(book.id)}%`)
         }
      }
      else {
         await book.updateMetadata()
      }
   }
   else {
      return new UpdateBookResponse({ type: ApiMessageType.UpdateBookResponse, message: `Couldn't find existing book with ID ${updateBookRequest.newBook.id}` })
   }

   const books = await bookList.allBooks()
   const statuses = await statusesForUser(updateBookRequest.token.user.id)

   return new UpdateBookResponse({ type: ApiMessageType.UpdateBookResponse, message: "", books: new Books({ type: ApiMessageType.Books, bookStatuses: statuses, directory: books }) })
})

server.get<{ Params: Record<string, string> }>("/files/*", { preHandler: validateRequest }, (request, reply) => {
   const filePath = request.params["*"] as string

   if (filePath.endsWith(".jpg")) {
      reply.sendFile(filePath, db.settings.baseBooksPath)
   }
   else if (filePath.endsWith(".m4b") || filePath.endsWith(".mp3")) {
      const splitPath = filePath.split("/")

      reply.header("Content-Disposition", `attachment; filename=\"${splitPath[splitPath.length - 1]}\"`)
      reply.sendFile(filePath, db.settings.baseBooksPath)
   }
   else {
      reply.code(404).send("Not Found")
   }
})

// This handles requests to the root of the site in production
server.get<{ Params: Record<string, string> }>("/*", (request, reply) => {
   let filePath = request.params["*"] as string || "index.html"

   if (filePath.startsWith("invite/")) {
      filePath = "index.html"
   }

   reply.sendFile(filePath, path.join(rootDir, "build"))
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

export default { start }
