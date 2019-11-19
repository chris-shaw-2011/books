import React, { useState, Fragment } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Navbar, Form, FormControl, Nav, FormControlProps } from "react-bootstrap"
import Authenticated from './Authenticated';
import "./styles.css"
import { ReplaceProps, BsPrefixProps } from 'react-bootstrap/helpers';
import LogIn from './LogIn';
import Token from '../shared/Token';
import { CookiesProvider, useCookies } from 'react-cookie';

const App: React.FC = () => {
   const [searchWords, setSearchWords] = useState(new Array<string>())
   const [cookies, setCookies] = useCookies(["loginCookie"])
   const [loginMessage, setLoginMessage] = useState("")
   const token = cookies.loginCookie ? new Token(cookies.loginCookie as Token) : undefined
   const logOut = (message?: string) => { setCookies("loginCookie", ""); setLoginMessage(message || "") }

   return (
      <div className="App">
         <CookiesProvider>
            <Navbar bg="dark" className="navbar" variant="dark">
               <Navbar.Brand>Books</Navbar.Brand>
               {token && <Fragment>
                  <Nav className="mr-auto">
                  </Nav>
                  <Form inline>
                     <FormControl type="text" placeholder="Search" className="mr-sm-2" onChange={(e: React.FormEvent<ReplaceProps<"input", BsPrefixProps<"input"> & FormControlProps>>) => {
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
                  </Nav>
               </Fragment>}
            </Navbar>
            <div className="mainContent">
               {token ?
                  <Authenticated searchWords={searchWords.map(w => w.toLowerCase())} token={token} onUnauthorized={(message?: string) => logOut(message)} /> :
                  <LogIn onAuthenticated={(newToken: Token) => { setCookies("loginCookie", JSON.stringify(newToken)); setLoginMessage("") }} message={loginMessage} />
               }
            </div>
         </CookiesProvider>
      </div>
   );
}

export default App;