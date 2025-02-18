import bookList from "./BookList.ts"
import db from "./Database.ts"
import server from "./server.ts"

await db.open()

void bookList.loadBooks()

await server.start()