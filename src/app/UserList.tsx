import moment from "dayjs"
import { useCallback, useContext, useEffect, useState } from "react"
import { Modal, Table } from "react-bootstrap"
import AccessDenied from "../shared/api/AccessDenied"
import Unauthorized from "../shared/api/Unauthorized"
import UserListResponse from "../shared/api/UserListResponse"
import User from "../shared/User"
import Api from "./api/LoggedInApi"
import Loading from "./Loading"
import LoggedInAppContext from "./LoggedInAppContext"
import OverlayComponent from "./components/OverlayComponent"
import TextboxField from "./components/TextboxField"
import CheckboxField from "./components/CheckboxField"
import CancelButton from "./components/CancelButton"
import OkButton from "./components/OkButton"
import DeleteButton from "./components/DeleteButton"
import Alert from "./components/Alert"

interface Props {
   onClose: () => void,
}

interface AddingUserState {
   addingUser: boolean,
   email: string,
   isAdmin: boolean,
   saving: boolean,
}

export default (props: Props) => {
   const context = useContext(LoggedInAppContext)
   const [users, setUsers] = useState({ users: new Array<User>(), message: "", confirmDeleteUser: "", deletingUser: "" })
   const [addingUserState, setAddingUserState] = useState<AddingUserState>({ addingUser: false, email: "", isAdmin: false, saving: false })
   const token = context.token
   const onUnauthorized = context.logOut
   const mergeAddingUserState = (obj: any) => {
      setAddingUserState(s => ({ ...s, ...obj }))
   }
   const handleUserListResponse = useCallback((ret: any) => {
      if (ret instanceof UserListResponse) {
         setUsers({ users: ret.users, message: ret.message, confirmDeleteUser: "", deletingUser: "" })
      }
      else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
         onUnauthorized(ret.message)
      }
      else {
         onUnauthorized("Something unexpected happened")
      }
   }, [onUnauthorized])
   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget

      event.preventDefault()
      event.stopPropagation()

      if (form.checkValidity()) {
         setAddingUserState(s => ({ ...s, saving: true }))

         const ret = await Api.addUser(token, new User({ email: addingUserState.email, isAdmin: addingUserState.isAdmin, id: "", lastLogin: 0, lastLoginDate: new Date() }))

         setAddingUserState(s => ({ ...s, addingUser: false }))

         handleUserListResponse(ret)
      }
   }
   const cancelAddUser = () => setAddingUserState(s => ({ ...s, addingUser: false }))
   const deleteClick = (userId: string) => {
      setUsers(s => ({ ...s, deletingUser: userId }))

      // tslint:disable-next-line: no-floating-promises
      Api.deleteUser(token, userId).then(ret => handleUserListResponse(ret))
   }
   useEffect(() => {
      async function getUsers() {
         const ret = await Api.users(token)

         handleUserListResponse(ret)
      }

      // tslint:disable-next-line: no-floating-promises
      getUsers()
   }, [token, onUnauthorized, setUsers, handleUserListResponse])

   if (!users.users.length) {
      return <Loading />
   }

   return (
      <OverlayComponent onClick={props.onClose}>
         <>
            {addingUserState.addingUser &&
               <OverlayComponent onClick={cancelAddUser}>
                  <form className="addUser" onSubmit={handleSubmit} onClick={e => e.target === e.currentTarget && cancelAddUser()}>
                     <Modal.Dialog>
                        <Modal.Header>
                           <Modal.Title>Add User</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                           <TextboxField label="Email address" type="email" placeholder="Enter email" required={true} autoFocus={true}
                              onChange={e => mergeAddingUserState({ email: e.currentTarget.value || "" })}
                           />
                           <CheckboxField type="checkbox" label="Is Admin?" onChange={e => mergeAddingUserState({ isAdmin: e.currentTarget.checked })} />
                        </Modal.Body>
                        <Modal.Footer>
                           {!addingUserState.saving ?
                              <>
                                 <CancelButton onClick={cancelAddUser} />
                                 <OkButton value="Add User" />
                              </> :
                              <Loading text="Adding User..." />}
                        </Modal.Footer>
                     </Modal.Dialog>
                  </form>
               </OverlayComponent>
            }
            <Table striped={true} bordered={true} hover={true} style={{ backgroundColor: "white" }}>
               <thead>
                  <tr>
                     <th>Email</th>
                     <th>Admin</th>
                     <th>Last Login</th>
                     <th>Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {users.users.map(u => {
                     return (
                        <tr key={u.id}>
                           <td>{u.email}</td>
                           <td>{u.isAdmin ? "Yes" : "No"}</td>
                           <td>{u.lastLogin ? moment(u.lastLoginDate).format("MM/D/YYYY, h:mm:ss a") : "Never"}</td>
                           <td>
                              {u.id !== token.user.id ?
                                 <>
                                    {u.id === users.confirmDeleteUser && users.deletingUser === u.id ?
                                       <Loading text="Deleting..." /> :
                                       u.id === users.confirmDeleteUser ?
                                          <>
                                             <CancelButton onClick={() => setUsers(s => ({ ...s, confirmDeleteUser: "" }))} />&nbsp;
                                             <DeleteButton onClick={() => deleteClick(u.id)} value="Confirm Delete" />
                                          </> :
                                          <DeleteButton onClick={() => setUsers(s => ({ ...s, confirmDeleteUser: u.id }))} />
                                    }
                                 </> :
                                 "Cannot delete logged in user"}
                           </td>
                        </tr>
                     )
                  })}
               </tbody>
               <tfoot>
                  <tr>
                     <td colSpan={4}>
                        {users.message && <Alert variant="primary">{users.message}</Alert>}
                        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-around" }}>
                           <CancelButton onClick={props.onClose} />
                           <OkButton onClick={() => {
                              setUsers(u => ({ ...u, message: "" }))
                              setAddingUserState({ addingUser: true, email: "", isAdmin: false, saving: false })
                           }} value="Add User" />
                        </div>
                     </td>
                  </tr>
               </tfoot>
            </Table>
         </>
      </OverlayComponent >
   )
}
