import db from "./Database"
import server from "./server"
import bookList from "./BookList"

async function start() {
   await db.open()

   bookList.loadBooks()

   await server.start()
}

start()