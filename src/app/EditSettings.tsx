import React, { FormEvent, Fragment, useContext, useEffect, useState } from "react"
import { Alert, Button, Form, Modal } from "react-bootstrap"
import AccessDenied from "../shared/api/AccessDenied"
import SettingsRequired from "../shared/api/SettingsRequired"
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse"
import Unauthorized from "../shared/api/Unauthorized"
import Settings from "../shared/Settings"
import Api from "./Api"
import Loading from "./Loading"
import AppContext from "./LoggedInAppContext"
import OverlayComponent from "./OverlayComponent"

interface Props {
   onSettingsSaved: () => void,
   message?: string,
   onClose?: () => void,
}

export default (props: Props) => {
   const [settings, setSettings] = useState<Settings | undefined>()
   const [validated, setValidated] = useState(false)
   const [saving, setSaving] = useState(false)
   const [message, setMessage] = useState(props.message)
   const context = useContext(AppContext)
   const onUnauthorized = context.logOut
   const token = context.token
   const onChange = (obj: any) => {
      setSettings(s => {
         if (!s) {
            s = new Settings()
         }

         return { ...s, ...obj }
      })
   }

   useEffect(() => {
      async function getSettings() {
         const ret = await Api.settings(token)

         if (ret instanceof SettingsRequired) {
            setSettings(ret.settings)
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            onUnauthorized(ret.message)
         }
         else {
            onUnauthorized("Received an unexpected response")
         }
      }

      getSettings()
   }, [onUnauthorized, token])

   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      setSaving(true)
      const form = event.currentTarget

      event.preventDefault()
      event.stopPropagation()

      if (form.checkValidity()) {
         const ret = await Api.updateSettings(token, settings!)

         if (ret instanceof SettingsUpdateResponse) {
            if (ret.successful) {
               props.onSettingsSaved()
               return
            }
            else {
               setMessage(ret.message)
               setValidated(false)
            }
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            context.logOut(ret.message)
            return
         }
         else {
            context.logOut("Received an unexpected response")
            return
         }
      }
      else {
         setValidated(true)
      }

      setSaving(false)
   }

   if (settings) {
      return (
         <OverlayComponent onClose={props.onClose}>
            <Form className="settings" noValidate={true} validated={validated} onSubmit={handleSubmit}>
               <Modal.Dialog>
                  <Modal.Header>
                     <Modal.Title>Settings</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                     {message ? <Alert variant="danger">{message}</Alert> : null}
                     <Form.Group controlId="formGroupBasePath">
                        <Form.Label>Base Books Path</Form.Label>
                        <Form.Control
                           type="text"
                           placeholder="Enter Base Path"
                           required={true}
                           defaultValue={settings.baseBooksPath}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ baseBooksPath: e.currentTarget.value || "" })}
                        />
                     </Form.Group>
                     <Form.Group controlId="fromGroupUploadLocation">
                        <Form.Label>Upload Location</Form.Label>
                        <Form.Control
                           type="text"
                           placeholder="Enter Upload Location"
                           required={true}
                           defaultValue={settings.uploadLocation}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ uploadLocation: e.currentTarget.value || "" })}
                        />
                     </Form.Group>
                     <Form.Group controlId="fromGroupInviteEmail">
                        <Form.Label>Invite Email Address</Form.Label>
                        <Form.Control
                           type="email"
                           placeholder="Enter Invite Email Address"
                           required={true}
                           defaultValue={settings.inviteEmail}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ inviteEmail: e.currentTarget.value || "" })}
                        />
                     </Form.Group>
                     <Form.Group controlId="fromGroupInviteEmailPassword">
                        <Form.Label>Invite Email Address</Form.Label>
                        <Form.Control
                           type="password"
                           placeholder="Enter Invite Email Password"
                           required={true}
                           defaultValue={settings.inviteEmailPassword}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ inviteEmailPassword: e.currentTarget.value || "" })}
                        />
                     </Form.Group>
                  </Modal.Body>
                  <Modal.Footer>
                     {!saving ?
                        <Fragment>
                           {props.onClose && <Button variant="secondary" onClick={props.onClose}>Cancel</Button>}
                           <Button variant="primary" type="submit">Save</Button>
                        </Fragment> : <Loading text="Saving..." />}
                  </Modal.Footer>
               </Modal.Dialog>
            </Form>
         </OverlayComponent>
      )
   }
   else {
      return <Loading />
   }
}
