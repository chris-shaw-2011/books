import bookList from "./BookList"
import db from "./Database"
import server from "./server"

async function start() {
   await db.open()

   // tslint:disable-next-line: no-floating-promises
   bookList.loadBooks()

   await server.start()
}

// tslint:disable-next-line: no-floating-promises
start()
