import bookList from "./BookList.ts"
import db from "./Database.ts"
import server from "./server.ts"

await db.open()

void bookList.loadBooks()

await server.start()

const shutdown = async () => {
	// eslint-disable-next-line no-console
	console.log("Received shutdown signal")
	await server.stop()

	// eslint-disable-next-line no-console
	console.log("Closing db connection...")

	await db.close() // if your db module supports clean shutdown

	// eslint-disable-next-line no-console
	console.log("Db connection closed.")

	await bookList.shutdown()

	// eslint-disable-next-line no-console
	console.log("Exiting program...")
	process.exit(0)
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.on("SIGINT", shutdown)
// eslint-disable-next-line @typescript-eslint/no-misused-promises
process.on("SIGTERM", shutdown)
