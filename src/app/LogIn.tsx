import React, { FormEvent, useState } from "react"
import Alert from "react-bootstrap/Alert"
import Button from "react-bootstrap/Button"
import Modal from "react-bootstrap/Modal"
import Form from "react-bootstrap/Form"
import AccessDenied from "../shared/api/AccessDenied"
import Token from "../shared/api/Token"
import Unauthorized from "../shared/api/Unauthorized"
import Api from "./api/Api"
import Loading from "./Loading"

interface Props {
   onAuthenticated: (token: Token) => void,
   message?: string,
}

export default (props: Props) => {
   const [email, setEmail] = useState("")
   const [password, setPassword] = useState("")
   const [validated, setValidated] = useState(false)
   const [logInState, setLogInState] = useState({ loggingIn: false, failedMessage: "" })
   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget

      event.preventDefault()
      event.stopPropagation()

      if (form.checkValidity()) {
         setLogInState({ loggingIn: true, failedMessage: "" })
         const ret = await Api.auth(email, password)

         if (ret instanceof Token) {
            props.onAuthenticated(ret)
            return
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            setLogInState({ loggingIn: false, failedMessage: ret.message })
         }
         else {
            setLogInState({ loggingIn: false, failedMessage: "Something unexpected happened" })
         }
      }

      setValidated(true)
   }

   return (
      <Form className="logIn" noValidate={true} validated={validated} onSubmit={handleSubmit}>
         <Modal.Dialog>
            <Modal.Header>
               <Modal.Title>Log In</Modal.Title>
            </Modal.Header>
            <Modal.Body>
               {logInState.failedMessage ? <Alert variant="danger">{logInState.failedMessage}</Alert> : props.message ? <Alert variant="danger">{props.message}</Alert> : null}
               <Form.Group controlId="formGroupEmail">
                  <Form.Label>Email address</Form.Label>
                  <Form.Control
                     type="email"
                     placeholder="Enter email"
                     required={true}
                     onChange={e => setEmail(e.currentTarget.value || "")}
                     autoFocus={true}
                  />
               </Form.Group>
               <Form.Group controlId="formGroupPassword">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                     type="password"
                     placeholder="Password"
                     required={true}
                     onChange={e => setPassword(e.currentTarget.value || "")}
                  />
               </Form.Group>
            </Modal.Body>
            <Modal.Footer>
               {!logInState.loggingIn ? <Button variant="primary" type="submit">Log In</Button> : <Loading text="Logging In..." />}
            </Modal.Footer>
         </Modal.Dialog>
      </Form>
   )
}
