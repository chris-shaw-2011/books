import React, { useState, FormEvent } from "react"
import { Form, Button, Modal, Alert } from "react-bootstrap"
import Api from "./Api"
import Loading from "./Loading"
import Token from "../shared/Token"

interface Props {
   onAuthenticated: (token: Token) => void,
   message?: string,
}

const LogIn: React.FC<Props> = (props: Props) => {
   const [email, setEmail] = useState("")
   const [password, setPassword] = useState("")
   const [validated, setValidated] = useState(false);
   const [logInState, setLogInState] = useState({ loggingIn: false, failedMessage: "" })

   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget;

      event.preventDefault();
      event.stopPropagation();

      if (form.checkValidity()) {
         setLogInState({ loggingIn: true, failedMessage: "" })
         var ret = await Api.auth(email, password);

         if (ret instanceof Token) {
            props.onAuthenticated(ret)
         }
         else if (!ret) {
            setLogInState({ loggingIn: false, failedMessage: "Something unexpected happened" })
         }
         else {
            setLogInState({ loggingIn: false, failedMessage: ret.message })
         }
      }

      setValidated(true);
   };

   return (
      <Form className="logIn" noValidate validated={validated} onSubmit={handleSubmit}>
         <Modal.Dialog>
            <Modal.Header>
               <Modal.Title>Log In</Modal.Title>
            </Modal.Header>
            <Modal.Body>
               {logInState.failedMessage ? <Alert variant="danger">{logInState.failedMessage}</Alert> : props.message ? <Alert variant="danger">{props.message}</Alert> : null}
               <Form.Group controlId="formGroupEmail">
                  <Form.Label>Email address</Form.Label>
                  <Form.Control type="email" placeholder="Enter email" required
                     onChange={(e: FormEvent<HTMLInputElement>) => setEmail(e.currentTarget.value || "")} />
               </Form.Group>
               <Form.Group controlId="formGroupPassword">
                  <Form.Label>Password</Form.Label>
                  <Form.Control type="password" placeholder="Password" required
                     onChange={(e: FormEvent<HTMLInputElement>) => setPassword(e.currentTarget.value || "")} />
               </Form.Group>
            </Modal.Body>
            <Modal.Footer>
               {!logInState.loggingIn ? <Button variant="primary" type="submit">Log In</Button> : <Loading text="Logging In..." />}
            </Modal.Footer>
         </Modal.Dialog>
      </Form>
   )
}

export default LogIn;