import { Mutex } from "async-mutex"
import bcrypt from "bcrypt"
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify"
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
import bookList from "./BookList.ts"
import Converter from "./Converter.ts"
import db from "./Database.ts"
import ServerToken from "./ServerToken.ts"
import NodeID3 from "node-id3"
import sanitize from "sanitize-filename"
import ServerBook from "./ServerBook.ts"
import aacWriter from "write-aac-metadata"
import { validateRequest } from "./Validation.ts"
import AuthorizationExpiration from "./AuthorizationExpiration.ts"
import cookie from "cookie"

// TODO: look into following current fastify standards
const __dirname = import.meta.dirname

const pump = util.promisify(pipeline)
const rootDir = __dirname
const getNewExpiration = () => dayjs().add(24, "hours")
const conversions = new Map<string, Converter>()
const conversionMutex = new Mutex()
const server = Fastify({ logger: false, bodyLimit: 10_000_000_000 })
const rootPath = path.join(rootDir, "../../../../bin/projects/client")
const validatePassword = async (email: string, password: string, reply: FastifyReply) => {
	const dbUser = db.getUserByEmail(email)

	if (dbUser) {
		if (await bcrypt.compare(password, dbUser.hash)) {
			const validatedUser = new shared.User(dbUser)
			const authorization = uuid()

			validatedUser.lastLogin = new Date()
			AuthorizationExpiration.set(authorization, getNewExpiration())

			db.updateUserLastLogin(validatedUser.id, validatedUser.lastLogin)

			return ServerToken.create(validatedUser, authorization, db.settings.checksumSecret)
		}
	}

	void reply.code(401)

	return new shared.Unauthorized("Invalid Email or Password")
}
const passwordHash = async (password: string) => bcrypt.hash(password, 10)
const validationResponse = (request: FastifyRequest, requiresAdmin?: boolean) => {
	const token = request.userToken

	if (token === undefined) {
		return new shared.Unauthorized("Please Log In")
	}

	const expiration = AuthorizationExpiration.get(token.authorization)

	if (expiration === undefined || expiration < dayjs()) {
		if (expiration !== undefined) {
			// Remove the token from memory since it expired
			AuthorizationExpiration.delete(token.authorization)
		}

		return new shared.Unauthorized("Session Expired, Please Log In Again")
	}

	AuthorizationExpiration.set(token.authorization, getNewExpiration())

	if (requiresAdmin && !token.user.isAdmin) {
		return new shared.AccessDenied("Access Denied")
	}

	// Request passed validation, let it carry on
	return undefined
}

const validateAdminRequest = (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
	const resp = validationResponse(request, true)

	if (resp) {
		reply.code(resp.code).send(resp)

		return
	}

	done()
}

server.addHook("preValidation", (request, _, done) => {
	const cookies = cookie.parse(request.headers.cookie ?? "")

	try {
		const userToken = ServerToken.fromJSON(db.settings.checksumSecret, cookies.loginCookie)

		if (userToken !== undefined) {
			request.userToken = userToken
		}
	}
	catch {
		// Don't worry about an error here
	}

	done()
})

void server.register(fastifyMultipart, {
	limits: {
		fieldNameSize: 100, // Max field name size in bytes
		fieldSize: 10_000_000_000, // Max field value size in bytes
		fields: 10, // Max number of non-file fields
		fileSize: 10_000_000_000, // For multipart forms, the max file size
		files: 1, // Max number of file fields
		headerPairs: 2000, // Max number of header key=>value pairs
	},
})

void server.register(fastifyStatic, {
	root: rootDir,
	prefix: "/unused/",
})

server.post<{ Body: shared.User }>("/auth", async (request, reply) => {
	const req = new shared.LoginRequest(request.body)

	if (!req.password) {
		return new shared.Unauthorized("You must specify a password")
	}

	if (db.noUsers) {
		// eslint-disable-next-line no-console
		console.warn(`Adding user ${req.email} to the database since they are the first login attempt`)

		const hash = await passwordHash(req.password)

		db.createBootstrapAdmin(req.email, hash)
	}

	return validatePassword(req.email, req.password, reply)
})

server.post("/books", { preHandler: validateRequest }, async request => {
	const token = request.userToken

	if (!token) {
		throw new ReferenceError()
	}

	if (!db.settings.baseBooksPath || !db.settings.inviteEmail || !db.settings.inviteEmailPassword || !db.settings.uploadLocation) {
		if (token.user.isAdmin) {
			return new shared.Books({ missingSettings: true })
		}
		else {
			return new shared.AccessDenied("Some settings are missing, but they must be specified by an administrator")
		}
	}

	const books = await bookList.allBooks()
	const statuses = db.statusesForUser(token.user.id)

	return new shared.Books({ directory: books, bookStatuses: statuses })
})

server.post("/settings", { preHandler: validateAdminRequest }, (_, reply) => {
	void reply.send(new shared.SettingsRequired({ settings: db.settings }))
})

server.post<{ Body: shared.SettingsUpdate }>("/updateSettings", { preHandler: validateAdminRequest }, async (request, reply) => {
	const settingsUpdate = new shared.SettingsUpdate(request.body)
	let settingsUpdated = false

	if (settingsUpdate.settings.baseBooksPath !== db.settings.baseBooksPath) {
		if (!fs.existsSync(settingsUpdate.settings.baseBooksPath)) {
			void reply.send(new shared.SettingsUpdateResponse({ message: `Path "${settingsUpdate.settings.baseBooksPath}" does not exist`, successful: false }))
		}

		db.settings.baseBooksPath = settingsUpdate.settings.baseBooksPath
		settingsUpdated = true

		// eslint-disable-next-line no-console
		console.log("Reloading all books into memory because of a settings change")
		void bookList.loadBooks()
	}

	if (db.settings.inviteEmail !== settingsUpdate.settings.inviteEmail) {
		db.settings.inviteEmail = settingsUpdate.settings.inviteEmail
		settingsUpdated = true

		// eslint-disable-next-line no-console
		console.log("inviteEmail setting updated", settingsUpdate.settings.inviteEmail)
	}

	if (db.settings.inviteEmailPassword !== settingsUpdate.settings.inviteEmailPassword) {
		db.settings.inviteEmailPassword = settingsUpdate.settings.inviteEmailPassword
		settingsUpdated = true

		// eslint-disable-next-line no-console
		console.log("inviteEmailPassword setting updated", settingsUpdate.settings.inviteEmailPassword)
	}

	if (db.settings.uploadLocation !== settingsUpdate.settings.uploadLocation) {
		db.settings.uploadLocation = settingsUpdate.settings.uploadLocation
		settingsUpdated = true

		// eslint-disable-next-line no-console
		console.log("uploadLocation setting updated", settingsUpdate.settings.uploadLocation)
	}

	if (settingsUpdated) {
		// eslint-disable-next-line no-console
		console.log("updating the database with the new settings", settingsUpdate.settings)

		db.settings.updateDbSettings()
	}

	void reply.send(new shared.SettingsUpdateResponse({ successful: true }))
})

server.post("/users", { preHandler: validateAdminRequest }, () => {
	const users = db.getAllUsers()

	return new shared.UserListResponse({ users })
})

server.post<{ Body: shared.AddUserRequest }>("/addUser", { preHandler: validateAdminRequest }, async request => {
	const userRequest = new shared.AddUserRequest(request.body)
	let message = `${userRequest.user.email} has been invited`
	let successful = false

	if (!userRequest.user.email) {
		message = "Email must be specified"
	}
	else {
		if (db.hasUserWithEmail(userRequest.user.email)) {
			message = "User already exists"
		}
		else {
			const userId = uuid()
			db.transaction(() => {
				db.insertInvitedUser(userId, userRequest.user.email, userRequest.user.isAdmin)
			})

			const link = new url.URL(`https://books.christopher-shaw.com/invite/${userId}`).href

			try {
				await db.settings.mailer.sendMail({
					from: db.settings.inviteEmail,
					to: userRequest.user.email,
					subject: "Invite to Audio Books Website",
					html: `
					You have been invited to the audio books website.<br /><br />
					You can sign up at: <a href="${link}">${link}</a>.
				`,
				})

				successful = true
			}
			catch (e) {
				db.transaction(() => {
					db.deleteUser(userId)
				})

				message = (e as Error).message
			}
		}
	}

	const users = db.getAllUsers()

	return new shared.AddUserResponse({ users, successful, message })
})

server.post<{ Body: shared.DeleteUserRequest }>("/deleteUser", { preHandler: validateAdminRequest }, request => {
	const userRequest = new shared.DeleteUserRequest(request.body)

	db.deleteUser(userRequest.userId)

	const users = db.getAllUsers()

	return new shared.UserListResponse({ users, message: "User deleted" })
})

server.post<{ Body: shared.UserRequest }>("/user", async (request, reply) => {
	const userRequest = new shared.UserRequest(request.body)

	const dbUser = db.getUserById(userRequest.userId)

	if (!dbUser || dbUser.lastLogin || dbUser.hash) {
		void reply.code(403)

		return new shared.AccessDenied("This user's password has already been set")
	}
	else {
		return new shared.UserResponse({ user: new shared.User(dbUser) })
	}
})

server.post<{ Body: shared.SetPasswordRequest }>("/setPassword", async (request, reply) => {
	const setRequest = new shared.SetPasswordRequest(request.body)
	const hash = await passwordHash(setRequest.newPassword)

	const user = db.transaction(() => {
		const existingUser = db.getUserById(setRequest.userId)

		if (!existingUser) {
			return new shared.AccessDenied("User not found")
		}
		else if (existingUser.hash) {
			return new shared.AccessDenied("User's password has already been set")
		}

		db.updateUserPassword(setRequest.userId, hash)

		return existingUser
	})

	if (user instanceof shared.AccessDenied) {
		return user
	}

	return await validatePassword(user.email, setRequest.newPassword, reply)
})

server.post<{ Body: shared.ChangePasswordRequest }>("/changePassword", { preHandler: validateRequest }, async (request, reply) => {
	const changeRequest = new shared.ChangePasswordRequest(request.body)
	const token = request.userToken
	const hash = await passwordHash(changeRequest.newPassword)

	if (!token) {
		throw new ReferenceError()
	}

	db.updateUserPassword(token.user.id, hash)

	return validatePassword(token.user.email, changeRequest.newPassword, reply)
})

server.post<{ Body: shared.ChangeBookStatusRequest }>("/changeBookStatus", { preHandler: validateRequest }, async request => {
	const statusRequest = new shared.ChangeBookStatusRequest(request.body)
	const token = request.userToken

	if (!token) {
		throw new ReferenceError()
	}

	const statuses = db.transaction(() => {
		const nextStatuses = db.statusesForUser(token.user.id)

		if (statusRequest.status !== "Unread") {
			nextStatuses.set(statusRequest.bookId, new shared.BookWithStatus({ status: statusRequest.status, dateStatusSet: new Date() }))
		}
		else {
			nextStatuses.delete(statusRequest.bookId)
		}

		db.updateStatusesForUser(token.user.id, nextStatuses)

		return nextStatuses
	})

	const books = await bookList.allBooks()

	return new shared.Books({ directory: books, bookStatuses: statuses })
})

server.post("/upload", { preHandler: validateRequest }, async (request, reply) => {
	const id = uuid()
	const file = await request.file()

	if (!file) {
		return
	}

	let fileName = file.filename
	let filePath = path.join(db.settings.uploadLocation, fileName)
	const conversion = new Converter()

	if (!shared.canBeUploaded(fileName)) {
		return
	}

	while (fs.existsSync(filePath)) {
		fileName = `${id}-${fileName}`
		filePath = path.join(db.settings.uploadLocation, fileName)
	}

	await pump(file.file, fs.createWriteStream(filePath))

	conversions.set(id, conversion)

	// Start the conversion in the background
	conversion.convert(filePath, db.settings.uploadLocation, conversionMutex, rootDir)
		.catch((reason: unknown) => {
			// eslint-disable-next-line no-console
			console.error(`Conversion ${id} failed:`, reason)
		})
		.finally(() => {
			setTimeout(() => {
				// eslint-disable-next-line no-console
				console.log(`Removing conversion ${id}`)
				conversions.delete(id)
			}, 60000)
		})

	// wait on the conversion process to start
	await conversion.waitForUpdate(0, "Waiting", [])

	void reply.code(200).send(new shared.UploadResponse({ conversionId: id, converterStatus: conversion.status }))
})

// TODO: change this to a websocket
server.post<{ Body: shared.ConversionUpdateRequest }>("/conversionUpdate", { preHandler: validateRequest }, async request => {
	const updateRequest = new shared.ConversionUpdateRequest(request.body)
	const conversion = conversions.get(updateRequest.conversionId)
	const response = new shared.ConversionUpdateResponse({ conversionPercent: 100, converterStatus: "Complete" })

	if (conversion) {
		if (conversion.status !== "Error") {
			await conversion.waitForUpdate(updateRequest.knownPercent, updateRequest.knownConverterStatus, updateRequest.knownWorkingFiles)
		}

		response.conversionPercent = conversion.percentComplete
		response.errorMessage = conversion.errorMessage
		response.converterStatus = conversion.status
		response.fileNames = conversion.fileNames

		if (conversion.status === "Complete") {
			response.book = bookList.findBookByPath(conversion.convertedFilePath) as ServerBook
		}
	}
	else {
		response.errorMessage = `No conversion found for id: ${updateRequest.conversionId}`
	}

	return response
})

server.post<{ Body: shared.AddFolderRequest }>("/addFolder", { preHandler: validateAdminRequest }, async request => {
	const token = request.userToken
	const addFolderRequest = new shared.AddFolderRequest(request.body)
	const fullPath = path.join(db.settings.baseBooksPath, addFolderRequest.path, addFolderRequest.folderName)

	if (!token) {
		throw new ReferenceError()
	}

	await fs.promises.mkdir(fullPath)

	await bookList.fileAdded(fullPath)

	const books = await bookList.allBooks()
	const statuses = db.statusesForUser(token.user.id)

	return new shared.Books({ directory: books, bookStatuses: statuses })
})

server.post<{ Body: shared.UpdateBookRequest }>("/updateBook", { preHandler: validateAdminRequest }, async request => {
	const updateBookRequest = new shared.UpdateBookRequest(request.body)
	// eslint-disable-next-line @stylistic/max-statements-per-line
	const token = request.userToken ?? (() => { throw new Error() })()
	const book = (await bookList.allBooks()).findById(updateBookRequest.newBook.id)
	const newBook = updateBookRequest.newBook

	if (!(book instanceof shared.Book)) {
		return new shared.UpdateBookResponse({ message: `Couldn't find existing book with ID ${updateBookRequest.newBook.id}` })
	}

	const newDir = path.join(db.settings.baseBooksPath, updateBookRequest.newBook.folderPath)
	const extension = path.extname(book.fullPath).toLowerCase()
	const newPath = path.join(newDir, `${sanitize(updateBookRequest.newBook.name.replace(/:/gi, " - "))}${extension}`)

	try {
		await bookList.pauseUpdates()

		// Check to see if the file needs renamed
		if (book.fullPath !== newPath) {
			if (fs.existsSync(newPath)) {
				return new shared.UpdateBookResponse({ message: `File ${newPath} already exists` })
			}

			// eslint-disable-next-line no-console
			console.log(`Renaming ${book.fullPath} to ${newPath}`)

			await fs.promises.rename(book.fullPath, newPath)

			if (fs.existsSync(book.photoPath)) {
				await fs.promises.unlink(book.photoPath)
			}

			await bookList.deleteBook(book.fullPath)
		}

		// TODO: change this to use taglib: https://github.com/benrr101/node-taglib-sharp#readme
		if (extension === ".mp3") {
			const tags = await NodeID3.Promise.read(newPath)

			tags.title = newBook.name.trim()
			tags.artist = newBook.author.trim().split(", ").map(v => v.trim()).join("/")
			tags.year = newBook.year.toString()
			tags.comment = {
				language: "eng",
				text: newBook.comment.trim(),
			}
			tags.composer = newBook.narrator.trim().split(", ").map(v => v.trim()).join("/")
			tags.genre = newBook.genre.trim().split(", ").map(v => v.trim()).join("/")

			await NodeID3.Promise.update(tags, newPath)

			/*			if (ret !== true) {
							const message = "Failed to update the ID3 tag of this book"

							console.error(message, ret)

							//TODO: change this to an error response
							return new shared.UpdateBookResponse({ message: message })
						} */
		}
		else if (book.name !== newBook.name || book.author !== newBook.author || book.year !== newBook.year || book.comment !== newBook.comment || book.narrator !== newBook.narrator || book.genre !== newBook.genre) {
			await aacWriter(newPath, { title: newBook.name.trim(), artist: newBook.author.trim(), year: newBook.year, comment: newBook.comment.trim(), composer: newBook.narrator.trim(), genre: newBook.genre.trim() }, undefined, { debug: true, pipeStdio: true })
		}

		if (book.fullPath !== newPath) {
			await bookList.fileAdded(newPath)

			const foundBook = bookList.findBookByPath(newPath)

			if (foundBook) {
				db.replaceBookStatusId(book.id, foundBook.id)
			}
		}
		else {
			await book.updateMetadata()
		}
	}
	finally {
		await bookList.resumeUpdates()
	}

	// eslint-disable-next-line no-console
	console.log(`Finished updating book ${newBook.name}, retrieving list of all books to return to client`)

	const books = await bookList.allBooks()
	const statuses = db.statusesForUser(token.user.id)

	// eslint-disable-next-line no-console
	console.log(`Returning list of books to client`)

	return new shared.UpdateBookResponse({ books: new shared.Books({ bookStatuses: statuses, directory: books }) })
})

server.get<{ Params: Record<string, string> }>("/files/*", { preHandler: validateRequest }, (request, reply) => {
	const filePath = request.params["*"] ?? ""

	if (filePath.endsWith(".jpg")) {
		reply.sendFile(filePath, db.settings.baseBooksPath)
	}
	else if (filePath.endsWith(".m4b") || filePath.endsWith(".mp3")) {
		const splitPath = filePath.split("/")

		reply.header("Content-Disposition", `attachment; filename="${splitPath[splitPath.length - 1]}"`)
		reply.sendFile(filePath, db.settings.baseBooksPath)
	}
	else {
		reply.code(404).send("Not Found")
	}
})

server.get<{ Params: Record<string, string> }>("/invite/*", async (_, reply) => {
	await reply.sendFile("index.html", rootPath)
})

server.get<{ Params: Record<string, string> }>("/assets/admin/*", { preHandler: validateAdminRequest }, async (request, reply) => {
	const pathname = new URL(request.raw.url ?? "", "http://dummy").pathname

	await reply.sendFile(pathname, rootPath)
})

server.get<{ Params: Record<string, string> }>("/assets/authenticated/*", { preHandler: validateRequest }, async (request, reply) => {
	const pathname = new URL(request.raw.url ?? "", "http://dummy").pathname

	await reply.sendFile(pathname, rootPath)
})

// This handles requests to the root of the site in production
server.get<{ Params: Record<string, string> }>("/*", async (request, reply) => {
	const filePath = request.params["*"] ?? ""

	await reply.sendFile(filePath, rootPath)
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

const stop = async () => {
	try {
		server.log.info("Shutting down Fastify...")
		await server.close()
		server.log.info("Shutdown complete.")
	}
	catch {
		server.log.error("Error during shutdown")
		process.exit(1)
	}
}

const inject = server.inject.bind(server)
const ready = server.ready.bind(server)

export default { start, stop, inject, ready }
