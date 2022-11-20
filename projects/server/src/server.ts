import { Mutex } from "async-mutex"
import bcrypt from "bcrypt"
import cookie from "cookie"
import fastify, { type FastifyRequest, type FastifyReply } from "fastify"
import fastifyMultipart from "@fastify/multipart"
import fastifyStatic from "@fastify/static"
import fs from "fs"
import dayjs from "dayjs"
import path from "path"
import util from "util"
import { pipeline } from "stream"
import url from "url"
import { v4 as uuid } from "uuid"
import * as shared from "@books/shared"
import bookList from "./BookList"
import Converter from "./Converter"
import db from "./Database"
import ServerToken from "./ServerToken"
import NodeID3 from "node-id3"
import sanitize from "sanitize-filename"
import ServerBook from "./ServerBook"
import aacWriter from "write-aac-metadata"
import { fileURLToPath } from "url"
import ServerUser from "./ServerUser"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pump = util.promisify(pipeline)
const authorizationExpiration = new Map<string, dayjs.Dayjs>()
const rootDir = __dirname
const tryParse = <T>(text: string, reviver?: (this: unknown, key: string, value: unknown) => T) => {
	try {
		return JSON.parse(text, reviver) as T
	}
	catch {
		return undefined
	}
}
const getNewExpiration = () => dayjs().add(24, "hours")
const changeBookStatusMutex = new Mutex()
const conversions = new Map<string, Converter>()
const conversionMutex = new Mutex()
const server = fastify({ logger: true, bodyLimit: 10_000_000_000 })
const getAllUsers = async (message?: string) => {
	const users = await db.all("SELECT id, email, isAdmin, lastLogIn FROM user")

	return new shared.UserListResponse({ users, type: shared.ApiMessageType.UserListResponse, message: message || "" })
}
const validatePassword = async (email: string, password: string, reply: FastifyReply) => {
	const dbUser = await db.get<ServerUser>("SELECT id, email, hash, isAdmin, lastLogIn FROM user WHERE email = ?", email)

	if (dbUser) {
		if (await bcrypt.compare(password, dbUser.hash)) {
			const validatedUser = new shared.User(dbUser)
			const authorization = uuid()

			validatedUser.lastLogin = new Date().getTime()
			authorizationExpiration.set(authorization, getNewExpiration())

			await db.run("UPDATE user SET lastLogIn = ? WHERE id = ?", validatedUser.lastLogin, validatedUser.id)

			return ServerToken.create(validatedUser, authorization, db.settings.checksumSecret)
		}
	}

	void reply.code(401)

	return new shared.Unauthorized({ type: shared.ApiMessageType.Unauthorized, message: "Invalid Email or Password" })
}
const passwordHash = async (password: string) => {
	return bcrypt.hash(password, 10)
}

const requestToken = (request: FastifyRequest) => {
	const cookies = cookie.parse(request.headers.cookie || "") || {}
	const loginCookie = tryParse<shared.Token>(cookies["loginCookie"])
	const tokenJson = cookies.loginCookie ? new ServerToken(loginCookie) : undefined

	return new ServerToken(tokenJson)
}
const validateToken = (request: FastifyRequest) => {
	const token = requestToken(request)

	if (!token.user.id || !token.isChecksumValid(db.settings.checksumSecret)) {
		return undefined
	}
	else {
		const expires = authorizationExpiration.has(token.authorization) ? authorizationExpiration.get(token.authorization) : undefined

		if (!expires || expires < dayjs()) {
			return undefined
		}

		authorizationExpiration.set(token.authorization, getNewExpiration())

		return token
	}
}
const validateRequest = (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
	const token = validateToken(request)

	if (!token) {
		void reply.code(401).send(new shared.Unauthorized({ type: shared.ApiMessageType.Unauthorized, message: "Please Log In" }))
	}

	done()
}
const validateAdminRequest = (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
	const resp = validateToken(request)

	if (resp instanceof ServerToken && !resp.user.isAdmin) {
		void reply.code(403).send(new shared.AccessDenied({ type: shared.ApiMessageType.AccessDenied, message: "Access Denied" }))
	}

	done()
}
const statusesForUser = async (userId: string) => {
	const qr = (await db.get<{ bookStatuses: string }>("SELECT bookStatuses FROM User WHERE id = ?", userId))
	const json = tryParse<shared.BookStatuses>(qr ? qr.bookStatuses : "")

	return new shared.BookStatuses(json)
}

void server.register(fastifyMultipart, {
	limits: {
		fieldNameSize: 100, // Max field name size in bytes
		fieldSize: 10_000_000_000, // Max field value size in bytes
		fields: 10,         // Max number of non-file fields
		fileSize: 10_000_000_000,      // For multipart forms, the max file size
		files: 1,           // Max number of file fields
		headerPairs: 2000,   // Max number of header key=>value pairs
	},
})

void server.register(fastifyStatic, {
	root: rootDir,
	prefix: "/unused/",
})

server.post<{ Body: shared.User }>("/auth", async (request, reply) => {
	const user = new shared.User(request.body)

	if (!user.password) {
		return new shared.Unauthorized({ message: "You must specify a password", type: shared.ApiMessageType.Unauthorized })
	}

	if (db.noUsers) {
		db.noUsers = false
		// eslint-disable-next-line no-console
		console.warn(`Adding user ${user.email} to the database since they are the first login attempt`)

		const hash = await passwordHash(user.password)

		await db.run("INSERT INTO user (id, email, hash, isAdmin) VALUES(?, ?, ?, ?)", uuid(), user.email, hash, 1)
	}

	return validatePassword(user.email, user.password, reply)
})

server.post("/books", { preHandler: validateRequest }, async request => {
	const token = requestToken(request)

	if (!db.settings.baseBooksPath || !db.settings.inviteEmail || !db.settings.inviteEmailPassword || !db.settings.uploadLocation) {
		if (token.user.isAdmin) {
			return new shared.SettingsRequired({ type: shared.ApiMessageType.SettingsRequired, message: "You must specify a setting", settings: db.settings })
		}
		else {
			return new shared.AccessDenied({ type: shared.ApiMessageType.AccessDenied, message: "Some settings are missing, but they must be specified by an administrator" })
		}
	}

	const books = await bookList.allBooks()
	const statuses = await statusesForUser(token.user.id)

	return new shared.Books({ type: shared.ApiMessageType.Books, directory: books, bookStatuses: statuses })
})

server.post("/settings", { preHandler: validateAdminRequest }, (_, reply) => {
	void reply.send(new shared.SettingsRequired({ type: shared.ApiMessageType.SettingsRequired, settings: db.settings, message: "" }))
})

server.post<{ Body: shared.SettingsUpdate }>("/updateSettings", { preHandler: validateAdminRequest }, async (request, reply) => {
	const settingsUpdate = new shared.SettingsUpdate(request.body)

	db.settings.inviteEmail = settingsUpdate.settings.inviteEmail
	db.settings.inviteEmailPassword = settingsUpdate.settings.inviteEmailPassword
	db.settings.uploadLocation = settingsUpdate.settings.uploadLocation

	if (settingsUpdate.settings.baseBooksPath !== db.settings.baseBooksPath) {
		if (!fs.existsSync(settingsUpdate.settings.baseBooksPath)) {
			void reply.send(new shared.SettingsUpdateResponse({ type: shared.ApiMessageType.SettingsUpdateResponse, message: `Path "${settingsUpdate.settings.baseBooksPath}" does not exist`, successful: false }))
		}

		db.settings.baseBooksPath = settingsUpdate.settings.baseBooksPath

		// eslint-disable-next-line no-console
		console.log("Loading all books into memory because of a settings change")
		await bookList.loadBooks()
	}

	void reply.send(new shared.SettingsUpdateResponse({ type: shared.ApiMessageType.SettingsUpdateResponse, message: "", successful: true }))
})

server.post("/users", { preHandler: validateAdminRequest }, async () => {
	return getAllUsers()
})

server.post<{ Body: shared.AddUserRequest }>("/addUser", { preHandler: validateAdminRequest }, async request => {
	const userRequest = new shared.AddUserRequest(request.body)
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

			const link = new url.URL(`https://books.christopher-shaw.com/invite/${userId}`).href

			await db.settings.mailer.sendMail({
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

	return getAllUsers(message)
})

server.post<{ Body: shared.DeleteUserRequest }>("/deleteUser", { preHandler: validateAdminRequest }, async request => {
	const userRequest = new shared.DeleteUserRequest(request.body)

	await db.run("DELETE FROM User WHERE id = ?", userRequest.userId)

	return getAllUsers("User deleted")
})

server.post<{ Body: shared.UserRequest }>("/user", async (request, reply) => {
	const userRequest = new shared.UserRequest(request.body)

	const dbUser = await db.get<shared.User & { hash: string }>("SELECT id, email, hash, isAdmin, lastLogin FROM User WHERE id = ?", userRequest.userId)

	if (!dbUser || dbUser.lastLogin || dbUser.hash) {
		void reply.code(403)

		return new shared.AccessDenied({ message: "This user has logged in or has a password already set", type: shared.ApiMessageType.AccessDenied })
	}
	else {
		return new shared.UserResponse({ user: new shared.User(dbUser), type: shared.ApiMessageType.UserResponse })
	}
})

server.post<{ Body: shared.ChangePasswordRequest }>("/changePassword", async (request, reply) => {
	const changeRequest = new shared.ChangePasswordRequest(request.body)

	if (changeRequest.token.authorization) {
		// This is a change password request for someone that's already logged in
		const token = validateToken(request)

		if (!token) {
			return token
		}
	}
	else {
		// This is a change password request for someone that's never logged in
		const dbUser = await db.get<{ lastLogin: number, hash: string }>("SELECT hash, lastLogin FROM User WHERE id = ?", changeRequest.token.user.id)

		if (!dbUser || dbUser.lastLogin || dbUser.hash) {
			void reply.code(403)

			return new shared.AccessDenied({ message: "This user has logged in or has a password already set", type: shared.ApiMessageType.AccessDenied })
		}
	}

	const hash = await passwordHash(changeRequest.newPassword)

	await db.run("UPDATE User SET hash = ? WHERE id = ?", hash, changeRequest.token.user.id)

	return validatePassword(changeRequest.token.user.email, changeRequest.newPassword, reply)
})

server.post<{ Body: shared.ChangeBookStatusRequest }>("/changeBookStatus", { preHandler: validateRequest }, async request => {
	const statusRequest = new shared.ChangeBookStatusRequest(request.body)
	const release = await changeBookStatusMutex.acquire()
	let statuses: shared.BookStatuses

	try {
		statuses = await statusesForUser(statusRequest.token.user.id)

		if (statusRequest.status !== shared.Status.Unread) {
			statuses[statusRequest.bookId] = new shared.BookWithStatus({ status: statusRequest.status, dateStatusSet: new Date().getTime() })
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

	return new shared.Books({ type: shared.ApiMessageType.Books, directory: books, bookStatuses: statuses })
})

server.post("/upload", { preHandler: validateRequest }, async (request, reply) => {
	const id = uuid()
	const file = await request.file()

	if (!file) {
		return
	}

	const fileName = `${id}${path.extname(file.filename)}`
	const filePath = path.join(db.settings.uploadLocation, fileName)
	const conversion = new Converter()

	await pump(file.file, fs.createWriteStream(filePath))

	conversions.set(id, conversion)

	// Start the conversion in the background
	void conversion.convert(fileName, db.settings.uploadLocation, conversionMutex, rootDir).then(() => {
		setTimeout(() => {
			// eslint-disable-next-line no-console
			console.log(`Removing conversion ${id}`)
			conversions.delete(id)
		}, 60000)
	})

	void reply.code(200).send(new shared.UploadResponse({ type: shared.ApiMessageType.UploadResponse, conversionId: id }))
})

server.post<{ Body: shared.ConversionUpdateRequest }>("/conversionUpdate", { preHandler: validateRequest }, async request => {
	const updateRequest = new shared.ConversionUpdateRequest(request.body)
	const conversion = conversions.get(updateRequest.conversionId)
	let book: ServerBook | undefined
	let response = { conversionPercent: 100, errorMessage: "", converterStatus: shared.ConverterStatus.Complete }

	if (conversion) {
		if (conversion.status !== shared.ConverterStatus.Error) {
			await conversion.waitForUpdate(updateRequest.knownPercent, updateRequest.knownConverterStatus)
		}

		response = { conversionPercent: conversion.percentComplete, errorMessage: conversion.errorMessage, converterStatus: conversion.status }

		if (conversion.status === shared.ConverterStatus.Complete) {
			book = bookList.findBookByPath(conversion.convertedFilePath) as ServerBook

			if (!book) {
				response.errorMessage = `Couldn't find book at path ${conversion.convertedFilePath}`
			}
		}
	}
	else {
		response.errorMessage = `No conversion found for id: ${updateRequest.conversionId}`
	}

	return new shared.ConversionUpdateResponse({ ...response, type: shared.ApiMessageType.ConversionUpdateResponse, book })
})

server.post<{ Body: shared.AddFolderRequest }>("/addFolder", { preHandler: validateAdminRequest }, async request => {
	const addFolderRequest = new shared.AddFolderRequest(request.body)
	const fullPath = path.join(db.settings.baseBooksPath, addFolderRequest.path, addFolderRequest.folderName)

	await fs.promises.mkdir(fullPath)

	await bookList.fileAdded(fullPath)

	const books = await bookList.allBooks()
	const statuses = await statusesForUser(addFolderRequest.token.user.id)

	return new shared.Books({ type: shared.ApiMessageType.Books, directory: books, bookStatuses: statuses })
})

server.post<{ Body: shared.UpdateBookRequest }>("/updateBook", { preHandler: validateAdminRequest }, async request => {
	const updateBookRequest = new shared.UpdateBookRequest(request.body)
	const book = (await bookList.allBooks()).findById(updateBookRequest.newBook.id)
	const newBook = updateBookRequest.newBook

	if (!(book instanceof shared.Book)) {
		return new shared.UpdateBookResponse({ type: shared.ApiMessageType.UpdateBookResponse, message: `Couldn't find existing book with ID ${updateBookRequest.newBook.id}` })
	}

	const newDir = path.join(db.settings.baseBooksPath, updateBookRequest.newBook.folderPath)
	const extension = path.extname(book.fullPath).toLowerCase()
	const newPath = path.join(newDir, `${sanitize(updateBookRequest.newBook.name.replace(/:/gi, " - "))}${extension}`)

	try {
		await bookList.pauseUpdates()

		// Check to see if the file needs renamed
		if (book.fullPath.toLowerCase() !== newPath.toLowerCase()) {
			if (fs.existsSync(newPath)) {
				return new shared.UpdateBookResponse({ type: shared.ApiMessageType.UpdateBookResponse, message: `File ${newPath} already exists` })
			}

			// eslint-disable-next-line no-console
			console.log(`Renaming ${book.fullPath} to ${newPath}`)

			await fs.promises.rename(book.fullPath, newPath)

			if (fs.existsSync(book.photoPath)) {
				await fs.promises.unlink(book.photoPath)
			}

			await bookList.deleteBook(book.fullPath)
		}

		if (extension === ".mp3") {
			const ret = NodeID3.update({ title: newBook.name, artist: newBook.author, year: newBook.year?.toString(), comment: { language: "eng", text: newBook.comment }, composer: newBook.narrator, genre: newBook.genre }, newPath)

			if (ret !== true) {
				// eslint-disable-next-line no-console
				console.log(ret)
				return new shared.UpdateBookResponse({ type: shared.ApiMessageType.UpdateBookResponse, message: ret.message })
			}
		}
		else if (book.name !== newBook.name || book.author !== newBook.author || book.year !== newBook.year || book.comment !== newBook.comment || book.narrator !== newBook.narrator || book.genre !== newBook.genre) {
			await aacWriter(newPath, { title: newBook.name, artist: newBook.author, year: newBook.year, comment: newBook.comment, composer: newBook.narrator, genre: newBook.genre }, undefined, { debug: true, pipeStdio: true })
		}

		if (book.fullPath !== newPath) {
			await bookList.fileAdded(newPath)

			const foundBook = bookList.findBookByPath(newPath)

			if (foundBook) {
				await db.run("UPDATE user SET bookStatuses = REPLACE(bookStatuses, ?, ?) WHERE bookStatuses LIKE ?", `${JSON.stringify(book.id)}`, `${JSON.stringify(foundBook.id)}`, `%${JSON.stringify(book.id)}%`)
			}
		}
		else {
			await book.updateMetadata()
		}
	}
	finally {
		bookList.resumeUpdates()
	}

	const books = await bookList.allBooks()
	const statuses = await statusesForUser(updateBookRequest.token.user.id)

	return new shared.UpdateBookResponse({ type: shared.ApiMessageType.UpdateBookResponse, message: "", books: new shared.Books({ type: shared.ApiMessageType.Books, bookStatuses: statuses, directory: books }) })
})

server.get<{ Params: Record<string, string> }>("/files/*", { preHandler: validateRequest }, (request, reply) => {
	const filePath = request.params["*"]

	if (filePath.endsWith(".jpg")) {
		void reply.sendFile(filePath, db.settings.baseBooksPath)
	}
	else if (filePath.endsWith(".m4b") || filePath.endsWith(".mp3")) {
		const splitPath = filePath.split("/")

		void reply.header("Content-Disposition", `attachment; filename="${splitPath[splitPath.length - 1]}"`)
		void reply.sendFile(filePath, db.settings.baseBooksPath)
	}
	else {
		void reply.code(404).send("Not Found")
	}
})

// This handles requests to the root of the site in production
server.get<{ Params: Record<string, string> }>("/*", (request, reply) => {
	let filePath = request.params["*"] || "index.html"

	if (filePath.startsWith("invite/")) {
		filePath = "index.html"
	}

	// eslint-disable-next-line no-console
	console.log({ filePath, fullPath: path.join(rootDir, "../client") })

	void reply.sendFile(filePath, path.join(rootDir, "../client"))
})

const start = async () => {
	try {
		await server.listen({ port: 3001, host: "::" })
	}
	catch (err) {
		server.log.error(err)
		process.exit(1)
	}
}

export default { start }
