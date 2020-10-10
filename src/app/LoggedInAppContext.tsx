import React from "react"
import Token from "../shared/api/Token"
import Directory from "../shared/Directory"

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

export default React.createContext<LoggedInAppContextType>({
   logOut: (message?: string) => { return },
   token: new Token(),
   visibleComponent: VisibleComponent.Books,
   setVisibleComponent: (component: VisibleComponent) => { return },
   updateBooks: (directory: Directory | undefined) => { return },
   rootDirectory: new Directory(),
})
