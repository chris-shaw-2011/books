import React, { useState, Fragment, useCallback } from 'react';
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

const App: React.FC = () => {
   const [searchWords, setSearchWords] = useState(new Array<string>())
   const [cookies, setCookies] = useCookies(["loginCookie"])
   const [loginMessage, setLoginMessage] = useState("")
   const [visibleComponent, setVisibleComponent] = useState(VisibleComponent.Books)
   const token = cookies.loginCookie ? new Token(cookies.loginCookie as Token) : undefined
   const inviteUserId = window.location.pathname.indexOf("/invite/") !== -1 ? window.location.pathname.replace("/invite/", "") : ""
   const logOut = useCallback((message?: string) => {
      if (inviteUserId) {
         window.history.replaceState({}, document.title, "/")
      }
      setCookies("loginCookie", "");
      setLoginMessage(message || "")
   }, [setCookies, setLoginMessage, inviteUserId])
   const onLogIn = useCallback((token: Token) => {
      if (inviteUserId) {
         window.history.replaceState({}, document.title, "/")
      }
      setCookies("loginCookie", JSON.stringify(token));
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
                        var search = (e.currentTarget.value || "").trim();

                        if (search) {
                           setSearchWords(search.split(" "))
                        }
                        else {
                           setSearchWords([])
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
                     <Authenticated searchWords={searchWords.map(w => w.toLowerCase())} onPasswordChanged={onLogIn} />
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