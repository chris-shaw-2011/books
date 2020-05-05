import "bootstrap/dist/css/bootstrap.min.css"
import React, { useCallback, useMemo, useState, Suspense } from "react"
import { CookiesProvider, useCookies } from "react-cookie"
import Token from "../shared/api/Token"
import ChangePassword from "./ChangePassword"
import AppContext, { VisibleComponent } from "./LoggedInAppContext"
import LogIn from "./LogIn"
import styles from "./App.module.scss"
import "./styles.css"
import Loading from "./Loading"
import Textbox from "./components/Textbox"

// tslint:disable-next-line: variable-name
const Navigation = React.lazy(() => import(/*
   webpackChunkName: "authenticated" */
   "./Navigation"))

// tslint:disable-next-line: variable-name
const Authenticated = React.lazy(() => import(/*
   webpackChunkName: "authenticated" */
   "./Authenticated"))

export default () => {
   const [searchWords, setSearchWords] = useState({ words: new Array<string>() })
   const [cookies, setCookies] = useCookies(["loginCookie"])
   const [loginMessage, setLoginMessage] = useState("")
   const [visibleComponent, setVisibleComponent] = useState(VisibleComponent.Books)
   const loginCookie = cookies.loginCookie
   const token = useMemo(() => loginCookie ? new Token(loginCookie) : undefined, [loginCookie])
   const inviteUserId = window.location.pathname.indexOf("/invite/") !== -1 ? window.location.pathname.replace("/invite/", "") : ""
   const logOut = useCallback((message?: string) => {
      if (inviteUserId) {
         window.history.replaceState({}, document.title, "/")
      }
      setCookies("loginCookie", "", { maxAge: 0 })
      setLoginMessage(message || "")
   }, [setCookies, setLoginMessage, inviteUserId])
   const onLogIn = useCallback((t: Token) => {
      if (inviteUserId) {
         window.history.replaceState({}, document.title, "/")
      }
      setCookies("loginCookie", JSON.stringify(t), { maxAge: 12 * 30 * 24 * 60 * 60, path: "/" })
      setLoginMessage("")
   }, [setCookies, setLoginMessage, inviteUserId])
   const searchChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
      const search = (e.currentTarget.value || "").trim()

      if (search) {
         setSearchWords({ words: search.split(" ").map(w => w.toLowerCase()) })
      }
      else {
         setSearchWords({ words: [] })
      }
   }

   return (
      <div className={styles.app}>
         <CookiesProvider>
            <div className={styles.navbar}>
               <img src="favicon.svg" alt="Book" />
               <h1>Audio Books</h1>
               <div className={styles.spacer} />
               {token &&
                  <>
                     <Textbox placeholder="Search" onChange={searchChanged} type="search" />
                     <Suspense fallback={<div />}>
                        <Navigation token={token} setVisibleComponent={setVisibleComponent} logOut={logOut} />
                     </Suspense>
                  </>
               }
            </div>
            <div className={styles.mainContent}>
               {token ?
                  <AppContext.Provider value={{ logOut, token, visibleComponent, setVisibleComponent }}>
                     <Suspense fallback={<Loading />}>
                        <Authenticated searchWords={searchWords} onPasswordChanged={onLogIn} />
                     </Suspense>
                  </AppContext.Provider> :
                  inviteUserId ?
                     <ChangePassword userId={inviteUserId} onPasswordChanged={onLogIn} logOut={logOut} /> :
                     <LogIn onAuthenticated={onLogIn} message={loginMessage} />
               }
            </div>
         </CookiesProvider>
      </div>
   )
}
