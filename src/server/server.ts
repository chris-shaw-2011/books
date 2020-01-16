import { Mutex } from "async-mutex"
import bcrypt from "bcrypt"
import cookie from "cookie"
import fastify from "fastify"
import fastifyMultipart from "fastify-multipart"
import fastifyStatic from "fastify-static"
import fs from "fs"
import { IncomingMessage, ServerResponse } from "http"
import moment from "moment"
import path from "path"
import pump from "pump"
import url from "url"
import uuid from "uuid"
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
import { Status } from "../shared/Book"
import BookStatuses from "../shared/BookStatuses"
import BookWithStatus from "../shared/BookWithStatus"
import { ConverterStatus } from "../shared/ConverterStatus"
import User from "../shared/User"
import bookList from "./BookList"
import Converter from "./Converter"
import db from "./Database"
import ServerToken from "./ServerToken"

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
const validatePassword = async (email: string, password: string, reply: fastify.FastifyReply<ServerResponse>) => {
   const dbUser = await db.get("SELECT id, email, hash, isAdmin, lastLogIn FROM user WHERE email = ?", [email])

   if (dbUser) {
      if (await bcrypt.compare(password, dbUser.hash)) {
         const validatedUser = new User(dbUser as User)
         const authorization = uuid.v4()

         validatedUser.lastLogin = new Date().getTime()
         authorizationExpiration.set(authorization, getNewExpiration())

         await db.run("UPDATE user SET lastLogIn = ? WHERE id = ?", [validatedUser.lastLogin, validatedUser.id])

         return ServerToken.create(validatedUser, authorization, db.settings.checksumSecret)
      }
   }

   reply.code(401)

   return new Unauthorized({ type: ApiMessageType.Unauthorized, message: "Invalid Email or Password" })
}
const passwordHash = async (password: string) => {
   return await bcrypt.hash(password, 10)
}
const requestToken = (request: fastify.FastifyRequest<IncomingMessage, fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, any>) => {
   const cookies = cookie.parse(request.headers.cookie || "") || {}
   const tokenJson = cookies.loginCookie ? new ServerToken(tryParse(cookies.loginCookie)) : undefined

   return new ServerToken(tokenJson)
}
const validateRequest = async (request: fastify.FastifyRequest<IncomingMessage, fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, any>, reply: fastify.FastifyReply<ServerResponse>) => {
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
const validateAdminRequest = async (request: fastify.FastifyRequest<IncomingMessage, fastify.DefaultQuery, fastify.DefaultParams, fastify.DefaultHeaders, any>, reply: fastify.FastifyReply<ServerResponse>) => {
   const resp = await validateRequest(request, reply)

   if (resp instanceof ServerToken && !resp.user.isAdmin) {
      reply.code(403).send(new AccessDenied({ type: ApiMessageType.AccessDenied, message: "Access Denied" }))
   }
}
const statusesForUser = async (userId: string) => {
   const json = (await db.get("SELECT bookStatuses FROM User WHERE id = ?", [userId])).bookStatuses

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

server.post("/auth", async (request, reply) => {
   const user = new User(request.body)

   if (db.noUsers) {
      db.noUsers = false
      console.warn(`Adding user ${user.email} to the database since they are the first login attempt`)

      const hash = await passwordHash(user.password)

      await db.run("INSERT INTO user (id, email, hash, isAdmin) VALUES(?, ?, ?, ?)", [uuid.v4(), user.email, hash, 1])
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

server.post("/updateSettings", { preHandler: validateAdminRequest }, (request, reply) => {
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

server.post("/addUser", { preHandler: validateAdminRequest }, async (request, reply) => {
   const userRequest = new AddUserRequest(request.body)
   let message = `${userRequest.user.email} has been invited`

   if (!userRequest.user.email) {
      message = "Email must be specified"
   }
   else {
      if (await db.get("SELECT id FROM User where email = ?", [userRequest.user.email])) {
         message = "User already exists"
      }
      else {
         const userId = uuid.v4()

         await db.run("INSERT INTO User (id, email, isAdmin) VALUES(?, ?, ?)", [userId, userRequest.user.email, userRequest.user.isAdmin])

         const link = url.resolve(request.headers.referer, `/invite/${userId}`)

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

server.post("/deleteUser", { preHandler: validateAdminRequest }, async (request, reply) => {
   const userRequest = new DeleteUserRequest(request.body)

   await db.run("DELETE FROM User WHERE id = ?", [userRequest.userId])

   return await getAllUsers("User deleted")
})

server.post("/user", async (request, reply) => {
   const userRequest = new UserRequest(request.body)

   const dbUser = await db.get("SELECT id, email, hash, isAdmin, lastLogin FROM User WHERE id = ?", [userRequest.userId])

   if (dbUser.lastLogin || dbUser.hash) {
      reply.code(403)

      return new AccessDenied({ message: "This user has logged in or has a password already set", type: ApiMessageType.AccessDenied })
   }
   else {
      return new UserResponse({ user: new User(dbUser), type: ApiMessageType.UserResponse })
   }
})

server.post("/changePassword", async (request, reply) => {
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
      const dbUser = await db.get("SELECT hash, lastLogin FROM User WHERE id = ?", [changeRequest.token.user.id])

      if (dbUser.lastLogin || dbUser.hash) {
         reply.code(403)

         return new AccessDenied({ message: "This user has logged in or has a password already set", type: ApiMessageType.AccessDenied })
      }
   }

   const hash = await passwordHash(changeRequest.newPassword)

   await db.run("UPDATE User SET hash = ? WHERE id = ?", [hash, changeRequest.token.user.id])

   return await validatePassword(changeRequest.token.user.email, changeRequest.newPassword, reply)
})

server.post("/changeBookStatus", { preHandler: validateRequest }, async (request, reply) => {
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

      await db.run("UPDATE User SET bookStatuses = ? WHERE id = ?", [JSON.stringify(statuses), statusRequest.token.user.id])
   }
   finally {
      release()
   }

   const books = await bookList.allBooks()

   return new Books({ type: ApiMessageType.Books, directory: books, bookStatuses: statuses })
})

server.post("/upload", { preHandler: validateRequest }, (request, reply) => {
   const id = uuid.v4()
   const mp = request.multipart(handler, onEnd)
   let fileName = ""
   let filePath = ""

   mp.on("field", (key: any, value: any) => {
      if (key === "fileName") {
         const parts = (value as string).split(".")

         fileName = `${id}.${parts[parts.length - 1]}`
         filePath = path.join(db.settings.uploadLocation, fileName)
      }
   })

   function onEnd(err: Error) {
      const conversion = new Converter()

      conversions.set(id, conversion)

      conversion.convert(fileName, db.settings.uploadLocation, conversionMutex).then(() => {
         setTimeout(() => conversions.delete(id), 60000)
      })

      reply.code(200).send(new UploadResponse({ type: ApiMessageType.UploadResponse, conversionId: id }))
   }

   function handler(field: string, file: any, filename: string, encoding: string, mimetype: string) {
      pump(file, fs.createWriteStream(filePath))
   }
})

server.post("/conversionUpdate", { preHandler: validateRequest }, async (request, reply) => {
   const updateRequest = new ConversionUpdateRequest(request.body)
   const conversion = conversions.get(updateRequest.conversionId)
   let response = { conversionPercent: 100, errorMessage: "", converterStatus: ConverterStatus.Complete }

   if (conversion) {
      if (conversion.status !== ConverterStatus.Error) {
         await conversion.waitForUpdate(updateRequest.knownPercent, updateRequest.knownConverterStatus)
      }

      response = { conversionPercent: conversion.percentComplete, errorMessage: conversion.errorMessage, converterStatus: conversion.status }
   }

   return new ConversionUpdateResponse({ ...response, type: ApiMessageType.ConversionUpdateResponse })
})

server.get("/files/*", { preHandler: validateRequest }, (request, reply) => {
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
server.get("/*", (request, reply) => {
   const filePath = request.params["*"] as string || "index.html"

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
