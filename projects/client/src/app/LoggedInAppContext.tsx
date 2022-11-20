import { createContext } from "react"
import { Token, Directory } from "@books/shared"

export enum VisibleComponent {
	Books,
	Settings,
	Users,
	ChangePassword,
	Upload,
}

interface LoggedInAppContextType {
	logOut: (message?: string) => void,
	token: Token,
	visibleComponent: VisibleComponent,
	setVisibleComponent: (component: VisibleComponent) => void,
	updateBooks: (directory: Directory) => void,
	rootDirectory: Directory,
}

const LoggedInAppContext = createContext<LoggedInAppContextType>({
	logOut: () => { return },
	token: new Token(),
	visibleComponent: VisibleComponent.Books,
	setVisibleComponent: () => { return },
	updateBooks: () => { return },
	rootDirectory: new Directory(),
})

export default LoggedInAppContext