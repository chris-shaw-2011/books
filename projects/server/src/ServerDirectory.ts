import fs from "fs"
import path from "path"
import ServerBook from "./ServerBook"
import { Directory } from "@books/shared"
import db from "./Database"

export default class ServerDirectory extends Directory {

	/**
	 *
	 * @param searchingPath The path we're looking for
	 * @param pathToCheck The current path to check for a partial match
	 */
	static isPartialPathMatch(searchingPath: string, pathToCheck: string) {
		return !path.relative(pathToCheck, searchingPath).startsWith("..")
	}

	fullPath = ""
	items: (ServerDirectory | ServerBook)[] = []
	parent?: ServerDirectory
	pathTree: string[] = []

	findById(id: string, searchDir?: ServerDirectory): ServerDirectory | ServerBook | undefined {
		const items = searchDir?.items ?? this.items
		for (const item of items) {
			if (item.id === id) {
				return item
			}
			else if (item instanceof ServerDirectory) {
				if (id.startsWith(item.id)) {
					return this.findById(id, item)
				}
			}
		}

		return undefined
	}

	findClosestDirectory(dirPath: string): ServerDirectory {
		for (const item of this.items) {
			if (item instanceof ServerDirectory) {
				if (ServerDirectory.isPartialPathMatch(dirPath, item.fullPath)) {
					return item.findClosestDirectory(dirPath)
				}
			}
		}

		return this
	}

	deleteBook(fullPath: path.ParsedPath) {
		const bookFullPath = path.join(fullPath.dir, fullPath.base)
		let closestDir = this.findClosestDirectory(fullPath.dir)

		if (closestDir) {
			for (let index = 0; index < closestDir.items.length; ++index) {
				const item = closestDir.items[index]

				if (item.fullPath === bookFullPath) {
					// eslint-disable-next-line no-console
					console.log(`Removing book ${item.fullPath}`)

					closestDir.items.splice(index, 1)

					break
				}
			}

			while (closestDir && closestDir.parent && closestDir.items.length === 0) {
				// eslint-disable-next-line no-console
				console.log(`Removing directory ${closestDir.fullPath}`)

				closestDir.parent.items.splice(closestDir.parent.items.indexOf(closestDir), 1)

				closestDir = closestDir.parent
			}
		}
	}

	async loadBooks(updatePath?: path.ParsedPath): Promise<boolean> {
		const pathTree = this.pathTree
		const currPath = path.join(db.settings.baseBooksPath, ...pathTree, this.name)
		const paths = await fs.promises.readdir(currPath, { withFileTypes: true })
		const newPathTree = this.name ? pathTree.concat(this.name) : pathTree
		const updatePathFullPath = updatePath ? path.join(updatePath.dir, updatePath.base) : undefined

		this.id = newPathTree.join("/")
		this.fullPath = currPath
		this.folderPath = `/${newPathTree.join("/")}`

		for (const p of paths) {
			const fullPath = path.join(currPath, p.name)

			if (p.isDirectory()) {
				if (!updatePathFullPath || ServerDirectory.isPartialPathMatch(fullPath, updatePathFullPath)) {
					const dir = new ServerDirectory()

					dir.name = p.name
					dir.pathTree = newPathTree

					dir.hasBooks = await dir.loadBooks(updatePath)
					dir.parent = this
					this.items.push(dir)
				}
			}
			else if (p.isFile() && (p.name.endsWith(".m4b") || p.name.endsWith(".mp3")) && (!updatePathFullPath || fullPath === updatePathFullPath)) {
				if (!this.items.find(i => i.fullPath === fullPath)) {
					const book = new ServerBook()
					book.parent = this

					await book.updateMetadata(fullPath)

					this.items.push(book)

					if (updatePathFullPath) {
						this.items.sort((a, b) => {
							const nameA = a.name.toUpperCase()
							const nameB = b.name.toUpperCase()

							if (nameA > nameB) {
								return 1
							}
							else if (nameA < nameB) {
								return -1
							}

							return 0
						})
					}
				}
				else {
					// eslint-disable-next-line no-console
					console.log(`${fullPath} - already in array, not added`)
				}
			}
		}

		if (this.items.length) {
			this.sortItems()

			return true
		}
		else {
			return false
		}
	}

	sortItems(sortParent?: boolean) {
		this.items.sort((a, b) => {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
		})

		if (sortParent) {
			this.parent?.sortItems(sortParent)
		}
	}
}
