import React, { useState, Fragment, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Navbar, Form, FormControl, Nav } from "react-bootstrap"
import Authenticated from './Authenticated';
import "./styles.css"
import LogIn from './LogIn';
import Token from '../shared/api/Token';
import { CookiesProvider, useCookies } from 'react-cookie';
import Gear from "./svg/Gear"
import AppContext from './LoggedInAppContext';

const App: React.FC = () => {
   const [searchWords, setSearchWords] = useState(new Array<string>())
   const [cookies, setCookies] = useCookies(["loginCookie"])
   const [loginMessage, setLoginMessage] = useState("")
   const [goToSettings, setGoToSettings] = useState(false)
   const token = cookies.loginCookie ? new Token(cookies.loginCookie as Token) : undefined
   const logOut = useCallback((message?: string) => { setCookies("loginCookie", ""); setLoginMessage(message || "") }, [setCookies, setLoginMessage])

   return (
      <div className="App">
         <CookiesProvider>
            <Navbar bg="dark" className="navbar" variant="dark">
               <Navbar.Brand><img src="favicon.svg" alt="Book" /> Audio Books</Navbar.Brand>
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
                     <Nav.Link onClick={() => { logOut(); return false; }}>Log Out</Nav.Link>
                     <Gear onClick={() => setGoToSettings(true)} />
                  </Nav>
               </Fragment>}
            </Navbar>
            <div className="mainContent">
               {token ?
                  <AppContext.Provider value={{ logOut: logOut, token: token }}>
                     <Authenticated searchWords={searchWords.map(w => w.toLowerCase())} goToSettings={goToSettings} clearGoToSettings={() => setGoToSettings(false)} />
                  </AppContext.Provider> :
                  <LogIn onAuthenticated={(newToken: Token) => { setCookies("loginCookie", JSON.stringify(newToken)); setLoginMessage("") }} message={loginMessage} />
               }
            </div>
         </CookiesProvider>
      </div>
   );
}

export default App;