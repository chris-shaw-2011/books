import chokidar, { FSWatcher } from "chokidar"
import fs from "fs"
import path from "path"
import db from "./Database.ts"
import ServerDirectory from "./ServerDirectory.ts"
import { Mutex, Semaphore, type SemaphoreInterface } from "async-mutex"
import { setTimeout } from "timers/promises"

class BookList {
	private books = new ServerDirectory()
	private watcher?: FSWatcher
	private mutex = new Mutex()
	private pauseSemaphore = new Semaphore(10)
	private loading = false
	private pauseReleaser?: SemaphoreInterface.Releaser

	async loadBooks() {
		const releaser = await this.mutex.acquire()
		this.loading = true

		if (this.watcher) {
			await this.watcher.close()
			delete this.watcher
		}

		// eslint-disable-next-line no-console
		console.log(`Loading books from ${db.settings.baseBooksPath}`)
		this.books = new ServerDirectory()

		try {
			await this.books.loadBooks()
		}
		catch (e) {
			// eslint-disable-next-line no-console
			console.error("An error occurred while loading the books", e)
		}

		// eslint-disable-next-line no-console
		console.log(`${this.books.bookCount()} Books loaded`)

		this.watcher = chokidar.watch(db.settings.baseBooksPath, {
			ignored: (checkPath: string, stats?: fs.Stats) => {
				if (!stats) {
					return false
				}

				checkPath = path.normalize(checkPath)

				if (stats.isDirectory()) {
					if (checkPath.startsWith(db.settings.uploadLocation) && db.settings.uploadLocation === checkPath) {
						return true
					}

					return false
				}
				else {
					const parsed = path.parse(checkPath)

					if (parsed.base && parsed.ext !== ".mp3" && parsed.ext !== ".m4b") {
						return true
					}

					return false
				}
			},
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 5000,
				pollInterval: 1000,
			},
			ignorePermissionErrors: true,
			usePolling: true,
			interval: 60000,
			binaryInterval: 60000,
		})
			.on("add", addPath => {
				// eslint-disable-next-line no-console
				console.log(`file added event: ${addPath}`)

				void this.pauseSemaphore.runExclusive(async () => {
					await this.fileAdded(addPath)
				})
			})
			.on("addDir", addPath => {
				// eslint-disable-next-line no-console
				console.log(`directory added event: ${addPath}`)

				void this.pauseSemaphore.runExclusive(async () => {
					await this.fileAdded(addPath)
				})
			})
			.on("unlink", delPath => {
				// eslint-disable-next-line no-console
				console.log(`file removed event: ${delPath}`)

				void this.pauseSemaphore.runExclusive(async () => {
					await this.deleteBook(delPath)
				})
			})

		this.loading = false
		releaser()
	}

	public async deleteBook(delPath: string) {
		// eslint-disable-next-line no-console
		console.log(`file removed: ${delPath} - queued`)

		const releaser = await this.mutex.acquire()

		// eslint-disable-next-line no-console
		console.log(`file removed: ${delPath} - processing`)

		this.books.deleteBook(path.parse(delPath))
		releaser()

		// eslint-disable-next-line no-console
		console.log(`file removed: ${delPath} - done`)
	}

	public async fileAdded(addPath: string) {
		// eslint-disable-next-line no-console
		console.log(`file added: ${addPath} - queued`)

		const releaser = await this.mutex.acquire()

		// eslint-disable-next-line no-console
		console.log(`file added: ${addPath} - processing`)

		const dir = this.books.findClosestDirectory(addPath)

		await dir.loadBooks(path.parse(addPath))

		dir.sortItems(true)

		releaser()

		// eslint-disable-next-line no-console
		console.log(`file added: ${addPath} - done`)
	}

	public findBookByPath(bookPath: string) {
		const dir = this.books.findClosestDirectory(bookPath)

		return dir.items.find(i => i.fullPath === bookPath)
	}

	public async allBooks() {
		if (this.loading) {
			await this.mutex.waitForUnlock()
		}

		return this.books
	}

	public async pauseUpdates() {
		[, this.pauseReleaser] = await this.pauseSemaphore.acquire()
	}

	async resumeUpdates() {
		if (!this.pauseReleaser) {
			// eslint-disable-next-line no-console
			console.error("resumeUpdates called without a matching pauseUpdates")

			return
		}

		this.pauseReleaser()

		// Make sure other threads can run before continuing
		await setTimeout(1)

		// Make sure any file changes that happened while paused are processed now
		await this.pauseSemaphore.runExclusive(() => Promise.resolve(), undefined, -1)
	}

	async shutdown() {
		if (this.watcher) {
			// eslint-disable-next-line no-console
			console.log("Closing file watcher...")
			await this.watcher.close()

			// eslint-disable-next-line no-console
			console.log("File watcher closed")
		}
	}
}

const bookList = new BookList()

export default bookList