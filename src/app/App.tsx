import React, { useState, Fragment, useCallback, useMemo } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Navbar, Form, FormControl, Nav } from "react-bootstrap"
import Authenticated from './Authenticated';
import "./styles.css"
import LogIn from './LogIn';
import Token from '../shared/api/Token';
import { CookiesProvider, useCookies } from 'react-cookie';
import Gear from "./svg/Gear"
import AppContext, { VisibleComponent } from './LoggedInAppContext';
import Users from "./svg/Users"
import ChangePassword from './ChangePassword';
import LogOut from './svg/LogOut';

var typingTimeout: NodeJS.Timeout

const App: React.FC = () => {
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
      setCookies("loginCookie", "", { maxAge: 0 });
      setLoginMessage(message || "")
   }, [setCookies, setLoginMessage, inviteUserId])
   const onLogIn = useCallback((token: Token) => {
      if (inviteUserId) {
         window.history.replaceState({}, document.title, "/")
      }
      setCookies("loginCookie", JSON.stringify(token), { maxAge: 12 * 30 * 24 * 60 * 60, path: "/" });
      setLoginMessage("")
   }, [setCookies, setLoginMessage, inviteUserId])

   return (
      <div className="App">
         <CookiesProvider>
            <Navbar bg="dark" className="navbar" variant="dark">
               <Navbar.Brand className="brand"><img src="favicon.svg" alt="Book" /><span style={{ paddingLeft: "5px" }}>Audio Books</span></Navbar.Brand>
               {token && <Fragment>
                  <Nav className="mr-auto">
                  </Nav>
                  <Form inline>
                     <FormControl type="text" placeholder="Search" className="mr-sm-2" onChange={(e: React.FormEvent<HTMLInputElement>) => {
                        clearTimeout(typingTimeout)

                        var search = (e.currentTarget.value || "").trim();

                        if (search) {
                           setSearchWords({ typing: true, words: search.split(" ").map(w => w.toLowerCase()) })

                           typingTimeout = setTimeout(() => setSearchWords(s => { return { ...s, typing: false } }), 500)
                        }
                        else {
                           setSearchWords({ typing: false, words: [] })
                        }
                     }} />
                  </Form>
                  <Nav>
                     <Nav.Link onClick={() => { setVisibleComponent(VisibleComponent.ChangePassword); return false; }}>Change<br />Password</Nav.Link>
                     <Nav.Link onClick={() => { logOut(); return false; }}><LogOut /></Nav.Link>
                     {token.user.isAdmin ?
                        <Fragment>
                           <Nav.Link onClick={() => { setVisibleComponent(VisibleComponent.Users); return false; }}><Users /></Nav.Link>
                           <Nav.Link onClick={() => { setVisibleComponent(VisibleComponent.Settings); return false; }}><Gear /> </Nav.Link>
                        </Fragment> :
                        null}
                  </Nav>
               </Fragment>}
            </Navbar>
            <div className="mainContent">
               {token ?
                  <AppContext.Provider value={{ logOut: logOut, token: token, visibleComponent: visibleComponent, setVisibleComponent: setVisibleComponent }}>
                     <Authenticated searchWords={searchWords} onPasswordChanged={onLogIn} />
                  </AppContext.Provider> :
                  inviteUserId ?
                     <ChangePassword userId={inviteUserId} onPasswordChanged={onLogIn} logOut={logOut} /> :
                     <LogIn onAuthenticated={onLogIn} message={loginMessage} />
               }
            </div>
         </CookiesProvider>
      </div>
   );
}

export default App;