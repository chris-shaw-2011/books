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
import ServerUser from "./ServerUser.ts"
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
const server = Fastify({ logger: true, bodyLimit: 10_000_000_000 })
const getAllUsers = async () => await db.all<shared.User[]>("SELECT id, email, isAdmin, lastLogIn FROM user")
const getUserById = async (userId: string) => await db.get<ServerUser>("SELECT * FROM user WHERE id = ?", userId)
const validatePassword = async (email: string, password: string, reply: FastifyReply) => {
	const dbUser = await db.get<ServerUser>("SELECT id, email, hash, isAdmin, lastLogIn FROM user WHERE email = ?", email)

	if (dbUser) {
		if (await bcrypt.compare(password, dbUser.hash)) {
			const validatedUser = new shared.User(dbUser)
			const authorization = uuid()

			validatedUser.lastLogin = new Date()
			AuthorizationExpiration.set(authorization, getNewExpiration())

			await db.run("UPDATE user SET lastLogIn = ? WHERE id = ?", validatedUser.lastLogin, validatedUser.id)

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
	const userToken = ServerToken.fromJSON(db.settings.checksumSecret, cookies.loginCookie)

	if (userToken !== undefined) {
		request.userToken = userToken
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
		db.noUsers = false
		// eslint-disable-next-line no-console
		console.warn(`Adding user ${req.email} to the database since they are the first login attempt`)

		const hash = await passwordHash(req.password)

		await db.run("INSERT INTO user (id, email, hash, isAdmin) VALUES(?, ?, ?, ?)", uuid(), req.email, hash, 1)
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
			return new shared.SettingsRequired({ message: "You must specify a setting", settings: db.settings })
		}
		else {
			return new shared.AccessDenied("Some settings are missing, but they must be specified by an administrator")
		}
	}

	const books = await bookList.allBooks()
	const statuses = await db.statusesForUser(token.user.id)

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

		await db.settings.updateDbSettings()
	}

	void reply.send(new shared.SettingsUpdateResponse({ successful: true }))
})

server.post("/users", { preHandler: validateAdminRequest }, async () => {
	const users = await getAllUsers()

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
		if (await db.get("SELECT id FROM User where email = ?", userRequest.user.email)) {
			message = "User already exists"
		}
		else {
			const userId = uuid()

			await db.exec("BEGIN TRANSACTION;")
			await db.run("INSERT INTO User (id, email, isAdmin) VALUES(?, ?, ?)", userId, userRequest.user.email, userRequest.user.isAdmin)

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

				await db.exec("COMMIT;")
				successful = true
			}
			catch (e) {
				await db.exec("ROLLBACK;")

				message = (e as Error).message
			}
		}
	}

	const users = await getAllUsers()

	return new shared.AddUserResponse({ users, successful, message })
})

server.post<{ Body: shared.DeleteUserRequest }>("/deleteUser", { preHandler: validateAdminRequest }, async request => {
	const userRequest = new shared.DeleteUserRequest(request.body)

	await db.run("DELETE FROM User WHERE id = ?", userRequest.userId)

	const users = await getAllUsers()

	return new shared.UserListResponse({ users, message: "User deleted" })
})

server.post<{ Body: shared.UserRequest }>("/user", async (request, reply) => {
	const userRequest = new shared.UserRequest(request.body)

	const dbUser = await getUserById(userRequest.userId)

	if (!dbUser || dbUser.lastLogin || dbUser.hash) {
		void reply.code(403)

		return new shared.AccessDenied("This user's password has already been set")
	}
	else {
		return new shared.UserResponse({ user: new shared.User(dbUser) })
	}
})

server.post<{ Body: shared.SetPasswordRequest }>("/setPassword", async (request, reply) => {
	let transactionEnd = "ROLLBACK;"
	const setRequest = new shared.SetPasswordRequest(request.body)

	await db.exec("BEGIN TRANSACTION;")

	try {
		const user = await getUserById(setRequest.userId)

		if (!user) {
			return new shared.AccessDenied("User not found")
		}
		else if (user.hash) {
			return new shared.AccessDenied("User's password has already been set")
		}

		const hash = await passwordHash(setRequest.newPassword)

		await db.run("UPDATE User SET hash = ? WHERE id = ?", hash, setRequest.userId)

		transactionEnd = "COMMIT;"

		return await validatePassword(user.email, setRequest.newPassword, reply)
	}
	finally {
		await db.exec(transactionEnd)
	}
})

server.post<{ Body: shared.ChangePasswordRequest }>("/changePassword", { preHandler: validateRequest }, async (request, reply) => {
	const changeRequest = new shared.ChangePasswordRequest(request.body)
	const token = request.userToken
	const hash = await passwordHash(changeRequest.newPassword)

	if (!token) {
		throw new ReferenceError()
	}

	await db.run("UPDATE User SET hash = ? WHERE id = ?", hash, token.user.id)

	return validatePassword(token.user.email, changeRequest.newPassword, reply)
})

server.post<{ Body: shared.ChangeBookStatusRequest }>("/changeBookStatus", { preHandler: validateRequest }, async request => {
	const statusRequest = new shared.ChangeBookStatusRequest(request.body)
	let statuses: shared.BookStatuses
	const token = request.userToken

	if (!token) {
		throw new ReferenceError()
	}

	await db.exec("BEGIN TRANSACTION;")

	try {
		statuses = await db.statusesForUser(token.user.id)

		if (statusRequest.status !== "Unread") {
			statuses.set(statusRequest.bookId, new shared.BookWithStatus({ status: statusRequest.status, dateStatusSet: new Date() }))
		}
		else {
			statuses.delete(statusRequest.bookId)
		}

		const update = JSON.stringify(statuses)

		await db.run("UPDATE user SET bookStatuses = ? WHERE id = ?", update, token.user.id)
	}
	finally {
		await db.exec("COMMIT;")
	}

	const books = await bookList.allBooks()

	return new shared.Books({ directory: books, bookStatuses: statuses })
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

	// wait on the conversion process to start
	await conversion.waitForUpdate(0, "Waiting")

	void reply.code(200).send(new shared.UploadResponse({ conversionId: id, converterStatus: conversion.status }))
})

server.post<{ Body: shared.ConversionUpdateRequest }>("/conversionUpdate", { preHandler: validateRequest }, async request => {
	const updateRequest = new shared.ConversionUpdateRequest(request.body)
	const conversion = conversions.get(updateRequest.conversionId)
	const response = new shared.ConversionUpdateResponse({ conversionPercent: 100, converterStatus: "Complete" })

	if (conversion) {
		if (conversion.status !== "Error") {
			await conversion.waitForUpdate(updateRequest.knownPercent, updateRequest.knownConverterStatus)
		}

		response.conversionPercent = conversion.percentComplete
		response.errorMessage = conversion.errorMessage
		response.converterStatus = conversion.status

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
	const statuses = await db.statusesForUser(token.user.id)

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
		if (book.fullPath.toLowerCase() !== newPath.toLowerCase()) {
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
			const tags = await NodeID3.Promise.read(book.fullPath)

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
				await db.run("UPDATE user SET bookStatuses = REPLACE(bookStatuses, ?, ?) WHERE bookStatuses LIKE ?", JSON.stringify(book.id), JSON.stringify(foundBook.id), `%${JSON.stringify(book.id)}%`)
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
	const statuses = await db.statusesForUser(token.user.id)

	return new shared.UpdateBookResponse({ books: new shared.Books({ bookStatuses: statuses, directory: books }) })
})

server.get<{ Params: Record<string, string> }>("/files/*", { preHandler: validateRequest }, (request, reply) => {
	const filePath = request.params["*"]

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

// This handles requests to the root of the site in production
server.get<{ Params: Record<string, string> }>("/*", (request, reply) => {
	let filePath = request.params["*"] || "index.html"
	const rootPath = path.join(rootDir, "../../../bin/client")

	if (filePath.startsWith("invite/")) {
		filePath = "index.html"
	}

	// eslint-disable-next-line no-console
	console.log({ filePath, fullPath: rootPath })

	void reply.sendFile(filePath, rootPath)
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