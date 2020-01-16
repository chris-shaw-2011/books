import "bootstrap/dist/css/bootstrap.min.css"
import React, { Fragment, useCallback, useMemo, useState } from "react"
import { Form, FormControl, Nav, Navbar, NavDropdown } from "react-bootstrap"
import { CookiesProvider, useCookies } from "react-cookie"
import Token from "../shared/api/Token"
import Authenticated from "./Authenticated"
import ChangePassword from "./ChangePassword"
import AppContext, { VisibleComponent } from "./LoggedInAppContext"
import LogIn from "./LogIn"
import "./styles.css"
import Gear from "./svg/Gear"
import Lock from "./svg/Lock"
import LogOut from "./svg/LogOut"
import Upload from "./svg/Upload"
import Users from "./svg/Users"

let typingTimeout: NodeJS.Timeout

export default () => {
   const [searchWords, setSearchWords] = useState({ typing: false, words: new Array<string>() })
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

   return (
      <div className="App">
         <CookiesProvider>
            <Navbar bg="dark" className="navbar" variant="dark">
               <Navbar.Brand className="brand"><img src="favicon.svg" alt="Book" /><span style={{ paddingLeft: "5px" }}>Audio Books</span></Navbar.Brand>
               {token && <Fragment>
                  <Nav className="mr-auto" />
                  <Form inline={true}>
                     <FormControl
                        type="text"
                        placeholder="Search"
                        className="mr-sm-2"
                        onChange={(e: React.FormEvent<HTMLInputElement>) => {
                           clearTimeout(typingTimeout)

                           const search = (e.currentTarget.value || "").trim()

                           if (search) {
                              setSearchWords({ typing: true, words: search.split(" ").map(w => w.toLowerCase()) })

                              typingTimeout = setTimeout(() => setSearchWords(s => ({ ...s, typing: false })), 500)
                           }
                           else {
                              setSearchWords({ typing: false, words: [] })
                           }
                        }}
                     />
                  </Form>
                  <Nav>
                     <NavDropdown title="" id="nav-dropdown" className="mainNav">
                        <NavDropdown.Item onClick={() => { setVisibleComponent(VisibleComponent.Upload); return false }}><Upload /> Upload Books</NavDropdown.Item>
                        {token.user.isAdmin &&
                           <Fragment>
                              <NavDropdown.Item onClick={() => { setVisibleComponent(VisibleComponent.Users); return false }}><Users /> Manage Users</NavDropdown.Item>
                              <NavDropdown.Item onClick={() => { setVisibleComponent(VisibleComponent.Settings); return false }}><Gear /> Settings</NavDropdown.Item>
                           </Fragment>}
                        <NavDropdown.Divider />
                        <NavDropdown.Item onClick={() => { setVisibleComponent(VisibleComponent.ChangePassword); return false }}><Lock /> Change Password</NavDropdown.Item>
                        <NavDropdown.Item onClick={() => { logOut(); return false }}><LogOut /> Log Out</NavDropdown.Item>
                     </NavDropdown>
                  </Nav>
               </Fragment>}
            </Navbar>
            <div className="mainContent">
               {token ?
                  <AppContext.Provider value={{ logOut, token, visibleComponent, setVisibleComponent }}>
                     <Authenticated searchWords={searchWords} onPasswordChanged={onLogIn} />
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
