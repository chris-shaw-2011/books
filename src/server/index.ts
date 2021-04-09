import bookList from "./BookList"
import db from "./Database"
import server from "./server"

async function start() {
   await db.open()

   void bookList.loadBooks()

   await server.start()
}

void start()
