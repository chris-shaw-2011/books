import { useEffect, useState } from "react"
import Alert from "./components/Alert"
import AccessDenied from "../shared/api/AccessDenied"
import { ApiMessageType } from "../shared/api/ApiMessage"
import Token from "../shared/api/Token"
import Unauthorized from "../shared/api/Unauthorized"
import UserResponse from "../shared/api/UserResponse"
import User from "../shared/User"
import Api from "./api/Api"
import Loading from "./Loading"
import OverlayComponent from "./components/OverlayComponent"
import styles from "./ChangePassword.module.scss"
import TextboxField from "./components/TextboxField"
import CancelButton from "./components/CancelButton"
import OkButton from "./components/OkButton"

interface Props {
   userId?: string,
   token?: Token,
   onPasswordChanged: (token: Token) => void,
   logOut: (message?: string) => void,
   onClose?: () => void,
}

const ChangePassword = (props: Props) => {
   const [state, setState] = useState({ password: "", confirmedPassword: "", changingPasswords: false })
   const [user, setUser] = useState(props.token ? props.token.user : undefined)
   const [passwordsMatch, setPasswordsMatch] = useState(true)
   const userId = props.userId || ""
   const logOut = props.logOut
   const mergeState = (obj: Record<string, unknown>) => {
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
         void getUser()
      }
   }, [logOut, userId])

   if (!user) {
      return <Loading />
   }
   else {
      return (
         <OverlayComponent onClick={props.onClose}>
            <form className={styles.changePassword} onSubmit={handleSubmit}>
               <div>
                  <div className={styles.header}>Change Password</div>
                  <div className={styles.body}>
                     <label className={styles.email}>{user.email}</label>
                     <TextboxField label="New Password" type="password" placeholder="New Password" required={true} onChange={e => mergeState({ password: e.currentTarget.value || "" })} />
                     <TextboxField label="Confirm New Password" type="password" placeholder="Confirm New Password" required={true} onChange={e => mergeState({ confirmedPassword: e.currentTarget.value || "" })} />
                     {!passwordsMatch && <Alert variant="danger">Passwords must match</Alert>}
                  </div>
                  <div className={styles.footer}>
                     {!state.changingPasswords ?
                        <>
                           {props.token && <CancelButton onClick={props.onClose} />}
                           <OkButton value="Change Password" />
                        </> :
                        <Loading text="Changing Password..." />}
                  </div>
               </div>
            </form>
         </OverlayComponent>
      )
   }
}

export default ChangePassword