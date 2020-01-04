import React from "react"
import Token from "../shared/api/Token"

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
}

const LoggedInAppContext = React.createContext<LoggedInAppContextType>({
   logOut: (message?: string) => { },
   token: new Token(),
   visibleComponent: VisibleComponent.Books,
   setVisibleComponent: (component: VisibleComponent) => { },
})

export default LoggedInAppContext
