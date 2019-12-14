import React from "react"
import Token from "../shared/api/Token"

interface LoggedInAppContextType {
   logOut: (message?: string) => void,
   token: Token,
}

const LoggedInAppContext = React.createContext<LoggedInAppContextType>({
   logOut: (message?: string) => { },
   token: new Token(),
})

export default LoggedInAppContext