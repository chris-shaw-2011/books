import React, { useState, FormEvent, useEffect, useContext, Fragment } from "react"
import Settings from "../shared/Settings"
import { Form, Modal, Button, Alert } from "react-bootstrap"
import Loading from "./Loading"
import Api from "./Api"
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse"
import Unauthorized from "../shared/api/Unauthorized"
import AccessDenied from "../shared/api/AccessDenied"
import SettingsRequired from "../shared/api/SettingsRequired"
import AppContext from "./LoggedInAppContext"
import OverlayComponent from "./OverlayComponent"

interface Props {
   onSettingsSaved: () => void,
   message?: string,
   onClose?: () => void,
}

const EditSettings: React.FC<Props> = (props: Props) => {
   const [settings, setSettings] = useState<Settings | undefined>()
   const [validated, setValidated] = useState(false);
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
         var ret = await Api.settings(token)

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
      const form = event.currentTarget;

      event.preventDefault();
      event.stopPropagation();

      if (form.checkValidity()) {
         var ret = await Api.updateSettings(token, settings!)

         if (ret instanceof SettingsUpdateResponse) {
            if (ret.successful) {
               props.onSettingsSaved()
               return;
            }
            else {
               setMessage(ret.message)
               setValidated(false);
            }
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            context.logOut(ret.message)
            return;
         }
         else {
            context.logOut("Received an unexpected response")
            return;
         }
      }
      else {
         setValidated(true)
      }

      setSaving(false)
   };

   if (settings) {
      return (
         <OverlayComponent onClose={props.onClose}>
            <Form className="settings" noValidate validated={validated} onSubmit={handleSubmit}>
               <Modal.Dialog>
                  <Modal.Header>
                     <Modal.Title>Settings</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                     {message ? <Alert variant="danger">{message}</Alert> : null}
                     <Form.Group controlId="formGroupBasePath">
                        <Form.Label>Base Books Path</Form.Label>
                        <Form.Control type="text" placeholder="Enter Base Path" required defaultValue={settings.baseBooksPath}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ baseBooksPath: e.currentTarget.value || "" })} />
                     </Form.Group>
                     <Form.Group controlId="fromGroupInviteEmail">
                        <Form.Label>Invite Email Address</Form.Label>
                        <Form.Control type="email" placeholder="Enter Invite Email Address" required defaultValue={settings.inviteEmail}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ inviteEmail: e.currentTarget.value || "" })} />
                     </Form.Group>
                     <Form.Group controlId="fromGroupInviteEmailPassword">
                        <Form.Label>Invite Email Address</Form.Label>
                        <Form.Control type="password" placeholder="Enter Invite Email Password" required defaultValue={settings.inviteEmailPassword}
                           onChange={(e: React.FormEvent<HTMLInputElement>) => onChange({ inviteEmailPassword: e.currentTarget.value || "" })} />
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

export default EditSettings