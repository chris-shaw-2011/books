import assert from "node:assert/strict"
import { test } from "node:test"
import { audibleBooks, AudibleImportBook, AudibleImportDirectory, AudibleImportResponse, Book, Books, Directory, type AudibleImportSnapshot } from "@books/shared"
import { itemOrders, orderItems } from "../src/app/ItemOrder.ts"

function assertUploadTimes(directory: Directory, min: number | undefined, max: number | undefined) {
	assert.equal(directory.minUploadTime?.getTime(), min)
	assert.equal(directory.maxUploadTime?.getTime(), max)
}

void test("directory upload bounds include direct and nested books, skipping empty folders", () => {
	const nested = new Directory({ items: [new Book({ uploadTime: 100 }), new Book({ uploadTime: 900 }), new Directory()] })
	const directory = new Directory()
	directory.items = [new Directory(), new Book({ uploadTime: 500 }), nested]
	assertUploadTimes(directory, 100, 900)

	const book = nested.items[0]
	assert.ok(book instanceof Book)
	book.uploadTime = new Date(1200)
	assertUploadTimes(directory, 500, 1200)

	nested.items = [new Book({ uploadTime: -100 })]
	assertUploadTimes(directory, -100, 500)
	directory.items = [new Directory({ items: [new Directory()] })]
	assertUploadTimes(directory, undefined, undefined)

	directory.items.push(new Book())
	assertUploadTimes(directory, 0, 0)
})

void test("only books serialize upload times and library responses restore recursive bounds", () => {
	const book = new Book({ id: "book", uploadTime: 1234 })
	const directory = new Directory({ items: [new Directory({ items: [book] })] })
	const json = JSON.stringify(new Books({ directory }))
	assert.equal((json.match(/"uploadTime"/g) ?? []).length, 1)
	assert.equal(json.includes("minUploadTime"), false)
	assert.equal(json.includes("maxUploadTime"), false)
	assert.equal("uploadTime" in directory, false)
	assert.equal(new Book(book.toJSON()).uploadTime.getTime(), 1234)

	const restored = new Books(JSON.parse(json) as Books).directory
	assert.equal(restored.minUploadTime?.getTime(), 1234)
	assert.equal(restored.maxUploadTime?.getTime(), 1234)
	const nested = restored.items[0]
	assert.ok(nested instanceof Directory)
	const restoredBook = nested.items[0]
	assert.ok(restoredBook instanceof Book)
	assert.ok(restoredBook.uploadTime instanceof Date)
	assert.equal(restoredBook.uploadTime.getTime(), 1234)
})

void test("Audible snapshot restoration calculates bounds without restoring legacy folder timestamps", () => {
	const directory = new AudibleImportDirectory()
	const nested = new AudibleImportDirectory()
	nested.items = [new AudibleImportBook({ asin: "ONE", uploadTime: new Date(100), percentage: 42 })]
	directory.items = [nested, new AudibleImportBook({ asin: "TWO", uploadTime: new Date(900) })]
	const snapshot = { books: [{ ...directory.toJSON(), uploadTime: 9999 }] }
	const restored = AudibleImportResponse.restoreSnapshot(JSON.parse(JSON.stringify(snapshot)) as AudibleImportSnapshot)
	const folder = restored.books[0]
	assert.ok(folder instanceof AudibleImportDirectory)
	assert.ok(folder.items[0] instanceof AudibleImportDirectory)
	assert.equal("uploadTime" in folder, false)
	assert.equal(folder.minUploadTime?.getTime(), 100)
	assert.equal(folder.maxUploadTime?.getTime(), 900)
	assert.ok(audibleBooks(restored.books)[0] instanceof AudibleImportBook)
	assert.equal(audibleBooks(restored.books)[0]?.percentage, 42)
	const sorted = orderItems(restored.books, "Uploaded - Descending")
	const sortedFolder = sorted[0]
	assert.ok(sortedFolder instanceof AudibleImportDirectory)
	assert.ok(sortedFolder.items[1] instanceof AudibleImportDirectory)
	assert.equal(audibleBooks(sortedFolder.items)[1], audibleBooks(folder.items)[0])
})

void test("Audible directories recursively construct import children and inherit directory behavior", () => {
	const source = new AudibleImportDirectory({ id: "series", name: "Series", folderPath: "/Series", hasBooks: true, items: [
		new AudibleImportDirectory({ items: [new AudibleImportBook({ asin: "ONE", percentage: 42, importStatus: "downloading", uploadTime: new Date(1234) })] }),
	] })
	const restored = new AudibleImportDirectory(JSON.parse(JSON.stringify(source)) as AudibleImportDirectory)
	assert.ok(restored instanceof Directory)
	assert.ok(restored.items[0] instanceof AudibleImportDirectory)
	const book = audibleBooks(restored.items)[0]
	assert.ok(book instanceof AudibleImportBook)
	assert.equal(book.percentage, 42)
	assert.equal(book.importStatus, "downloading")
	assert.equal(restored.id, "series")
	assert.equal(restored.folderPath, "/Series")
	assert.equal(restored.hasBooks, true)
	assert.equal(restored.bookCount(), 1)
	assert.equal(restored.findBookByAsin("ONE"), book)
	assertUploadTimes(restored, 1234, 1234)
	assert.deepEqual(new AudibleImportDirectory().items, [])
})

void test("upload comparators use recursive directory bounds before children are sorted", () => {
	const nested = new Directory({ items: [new Book({ uploadTime: 900 }), new Book({ uploadTime: 100 })] })
	const folder = new Directory({ items: [new Directory(), nested] })
	const middle = new Book({ uploadTime: 500 })
	assert.ok(itemOrders["Uploaded - Ascending"](folder, middle) < 0)
	assert.ok(itemOrders["Uploaded - Descending"](folder, middle) < 0)
	const empty = new Directory()
	assert.ok(itemOrders["Uploaded - Ascending"](empty, middle) < 0)
	assert.ok(itemOrders["Uploaded - Descending"](empty, middle) > 0)
})
