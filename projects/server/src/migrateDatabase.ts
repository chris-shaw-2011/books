import { migrateLegacyDatabase, resolveDatabaseLocation } from "./Database.ts"

const dbLocation = resolveDatabaseLocation()
const backupPath = await migrateLegacyDatabase(dbLocation)

if (backupPath === null) {
	// eslint-disable-next-line no-console
	console.log(`Database at ${dbLocation} is already at the current schema version.`)
}
else {
	// eslint-disable-next-line no-console
	console.log(`Database migrated successfully at ${dbLocation}.`)
	// eslint-disable-next-line no-console
	console.log(`Backup created at ${backupPath}.`)
}
