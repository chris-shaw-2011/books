import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Navbar, Form, FormControl, Nav, FormControlProps } from "react-bootstrap"
import Authenticated from './Authenticated';
import "./styles.css"
import { ReplaceProps, BsPrefixProps } from 'react-bootstrap/helpers';
import LogIn from './LogIn';

const App: React.FC = () => {
   const [searchWords, setSearchWords] = useState(new Array<string>())
   const [authenticated, setAuthenticated] = useState(false)

   return (
      <div className="App">
         <Navbar bg="dark" className="navbar" variant="dark">
            <Navbar.Brand>Books</Navbar.Brand>
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
         </Navbar>
         <div className="mainContent">
            {authenticated ?
               <Authenticated searchWords={searchWords.map(w => w.toLowerCase())} /> :
               <LogIn onAuthenticated={() => setAuthenticated(true)} />
            }
         </div>
      </div>
   );
}

export default App;