import bookList from "./BookList"
import db from "./Database"
import server from "./server"

await db.open()

void bookList.loadBooks()

await server.start()