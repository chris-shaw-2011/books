import { useContext, useEffect, useState } from "react"
import { Modal } from "react-bootstrap"
import Alert from "./components/Alert"
import AccessDenied from "../shared/api/AccessDenied"
import SettingsRequired from "../shared/api/SettingsRequired"
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse"
import Unauthorized from "../shared/api/Unauthorized"
import Settings from "../shared/Settings"
import Api from "./api/LoggedInApi"
import Loading from "./Loading"
import AppContext from "./LoggedInAppContext"
import OverlayComponent from "./components/OverlayComponent"
import TextboxField from "./components/TextboxField"
import CancelButton from "./components/CancelButton"
import OkButton from "./components/OkButton"

interface Props {
   onSettingsSaved: () => void,
   message?: string,
   onClose?: () => void,
}

export default (props: Props) => {
   const [settings, setSettings] = useState<Settings | undefined>()
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

      // tslint:disable-next-line: no-floating-promises
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

      setSaving(false)
   }

   if (settings) {
      return (
         <OverlayComponent onClick={props.onClose}>
            <form className="settings" onSubmit={handleSubmit}>
               <Modal.Dialog>
                  <Modal.Header>
                     <Modal.Title>Settings</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                     {message ? <Alert variant="danger">{message}</Alert> : null}
                     <TextboxField label="Base Books Path" type="text" placeholder="Enter Base Path" required={true} defaultValue={settings.baseBooksPath}
                        onChange={e => onChange({ baseBooksPath: e.currentTarget.value || "" })}
                     />
                     <TextboxField label="Upload Location" type="text" placeholder="Enter Upload Location" required={true} defaultValue={settings.uploadLocation}
                        onChange={e => onChange({ uploadLocation: e.currentTarget.value || "" })}
                     />
                     <TextboxField label="Invite Email Address" type="email" placeholder="Enter Invite Email Address" required={true} defaultValue={settings.inviteEmail}
                        onChange={e => onChange({ inviteEmail: e.currentTarget.value || "" })}
                     />
                     <TextboxField label="Invite Email Address" type="password" placeholder="Enter Invite Email Password" required={true} defaultValue={settings.inviteEmailPassword}
                        onChange={e => onChange({ inviteEmailPassword: e.currentTarget.value || "" })}
                     />
                  </Modal.Body>
                  <Modal.Footer>
                     {!saving ?
                        <>
                           {props.onClose && <CancelButton onClick={props.onClose} />}
                           <OkButton type="submit" value="Save" />
                        </> : <Loading text="Saving..." />}
                  </Modal.Footer>
               </Modal.Dialog>
            </form >
         </OverlayComponent >
      )
   }
   else {
      return <Loading />
   }
}
