import { createContext } from "react"
import { Token, Directory } from "@books/shared"

// TODO: this should probably be renamed AppContext and it should contain things that are availble whether logged in or not
// anything that's only avilable after logging in should be moved to a new LoggedInAppContext object

interface LoggedInAppContextType {
	token: Token,
	updateBooks: (directory: Directory) => void,
	rootDirectory: Directory,
}

const LoggedInAppContext = createContext<LoggedInAppContextType>({
	token: new Token(),
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	updateBooks: () => { },
	rootDirectory: new Directory(),
})

export default LoggedInAppContext