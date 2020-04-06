import React, { FormEvent, Fragment, useEffect, useState } from "react"
import { Alert, Button, Form, Modal } from "react-bootstrap"
import AccessDenied from "../shared/api/AccessDenied"
import { ApiMessageType } from "../shared/api/ApiMessage"
import Token from "../shared/api/Token"
import Unauthorized from "../shared/api/Unauthorized"
import UserResponse from "../shared/api/UserResponse"
import User from "../shared/User"
import Api from "./api/Api"
import Loading from "./Loading"
import OverlayComponent from "./OverlayComponent"

interface Props {
   userId?: string,
   token?: Token,
   onPasswordChanged: (token: Token) => void,
   logOut: (message?: string) => void,
   onClose?: () => void,
}

export default (props: Props) => {
   const [state, setState] = useState({ password: "", confirmedPassword: "", changingPasswords: false })
   const [user, setUser] = useState(props.token ? props.token.user : undefined)
   const [passwordsMatch, setPasswordsMatch] = useState(true)
   const [validated, setValidated] = useState(false)
   const userId = props.userId || ""
   const logOut = props.logOut
   const mergeState = (obj: any) => {
      setState(s => {
         return {
            ...s,
            ...obj,
         }
      })
   }
   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget

      event.preventDefault()
      event.stopPropagation()

      if (form.checkValidity()) {
         if (state.password !== state.confirmedPassword) {
            setPasswordsMatch(false)
         }
         else {
            setPasswordsMatch(true)
            setState(s => ({ ...s, changingPasswords: true }))

            const ret = await Api.changePassword(props.token || { authorization: "", checksum: "", type: ApiMessageType.Token, user: new User(user) }, state.password)

            if (ret instanceof Token) {
               props.onPasswordChanged(ret)
            }
            else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
               logOut(ret.message)
            }
            else {
               logOut("Something unexpected happened")
            }

            return
         }
      }

      setValidated(true)
   }

   useEffect(() => {
      async function getUser() {
         const ret = await Api.user(userId)

         if (ret instanceof UserResponse) {
            setUser(ret.user)
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            logOut(ret.message)
         }
         else {
            logOut("Received an unexpected response")
         }
      }

      if (userId) {
         getUser()
      }
   }, [logOut, userId])

   if (!user) {
      return <Loading />
   }
   else {
      return (
         <OverlayComponent onClose={props.onClose}>
            <Form className="changePassword" noValidate={true} validated={validated} onSubmit={handleSubmit}>
               <Modal.Dialog>
                  <Modal.Header>
                     <Modal.Title>Change Password</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                     <Form.Group controlId="formGroupEmail">
                        <Form.Label>{user.email}</Form.Label>
                     </Form.Group>
                     <Form.Group controlId="formGroupPassword">
                        <Form.Label>New Password</Form.Label>
                        <Form.Control type="password" placeholder="New Password" required={true} onChange={(e: FormEvent<HTMLInputElement>) => mergeState({ password: e.currentTarget.value || "" })} />
                     </Form.Group>
                     <Form.Group controlId="formGroupConfirmPassword">
                        <Form.Label>Confirm New Password</Form.Label>
                        <Form.Control type="password" placeholder="Confirm New Password" required={true} onChange={(e: FormEvent<HTMLInputElement>) => mergeState({ confirmedPassword: e.currentTarget.value || "" })} />
                     </Form.Group>
                     {!passwordsMatch && <Alert variant="danger">Passwords must match</Alert>}
                  </Modal.Body>
                  <Modal.Footer>
                     {!state.changingPasswords ?
                        <Fragment>
                           {props.token && <Button variant="secondary" type="button" onClick={props.onClose}>Cancel</Button>}
                           <Button variant="primary" type="submit">Change Password</Button>
                        </Fragment> :
                        <Loading text="Changing Password..." />}
                  </Modal.Footer>
               </Modal.Dialog>
            </Form>
         </OverlayComponent>
      )
   }
}
