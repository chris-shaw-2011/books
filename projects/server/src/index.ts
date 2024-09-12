import bookList from "./BookList.js"
import db from "./Database.js"
import server from "./server.js"

await db.open()

void bookList.loadBooks()

await server.start()