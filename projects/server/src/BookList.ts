import chokidar from "chokidar"
import fs from "fs"
import path from "path"
import db from "./Database.js"
import ServerDirectory from "./ServerDirectory.js"
import { Mutex, Semaphore } from "async-mutex"

class BookList {
	private books = new ServerDirectory()
	private watcher?: chokidar.FSWatcher
	private mutex = new Mutex()
	private pauseSemaphore = new Semaphore(10)
	private loading = false

	async loadBooks() {
		await this.mutex.acquire()
		this.loading = true

		if (this.watcher) {
			await this.watcher.close()
			this.watcher = undefined
		}

		// eslint-disable-next-line no-console
		console.log(`Loading books from ${db.settings.baseBooksPath}`)
		this.books = new ServerDirectory()

		await this.books.loadBooks()

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
				void this.pauseSemaphore.runExclusive(async () => {
					await this.fileAdded(addPath)
				})
			})
			.on("addDir", addPath => {
				void this.pauseSemaphore.runExclusive(async () => {
					await this.fileAdded(addPath)
				})
			})
			.on("unlink", delPath => {
				void this.pauseSemaphore.runExclusive(async () => {
					await this.deleteBook(delPath)
				})
			})

		this.loading = false
		this.mutex.release()
	}

	public async deleteBook(delPath: string) {
		// eslint-disable-next-line no-console
		console.log(`file removed: ${delPath}`)

		await this.mutex.acquire()
		this.books.deleteBook(path.parse(delPath))
		this.mutex.release()
	}

	public async fileAdded(addPath: string) {
		// eslint-disable-next-line no-console
		console.log(`file added: ${addPath}`)

		await this.mutex.acquire()

		const dir = this.books.findClosestDirectory(addPath)

		await dir.loadBooks(path.parse(addPath))

		dir.sortItems(true)

		this.mutex.release()
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
		await this.pauseSemaphore.acquire()
	}

	resumeUpdates() {
		this.pauseSemaphore.release()
	}
}

const bookList = new BookList()

export default bookList
