import React from "react"
import { Form, Button, Modal } from "react-bootstrap"

interface Props {
   onAuthenticated: () => void,
}

const LogIn: React.FC<Props> = (props: Props) => {
   return (
      <Form className="logIn">
         <Modal.Dialog>
            <Modal.Header>
               <Modal.Title>Log In</Modal.Title>
            </Modal.Header>
            <Modal.Body>
               <Form.Group controlId="formGroupEmail">
                  <Form.Label>Email address</Form.Label>
                  <Form.Control type="email" placeholder="Enter email" required />
               </Form.Group>
               <Form.Group controlId="formGroupPassword">
                  <Form.Label>Password</Form.Label>
                  <Form.Control type="password" placeholder="Password" required />
               </Form.Group>
            </Modal.Body>
            <Modal.Footer>
               <Button variant="primary" onClick={() => props.onAuthenticated()}>Log In</Button>
            </Modal.Footer>
         </Modal.Dialog>
      </Form>
   )
}

export default LogIn;