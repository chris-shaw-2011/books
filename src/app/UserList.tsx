import React, { useEffect, useContext, useState, FormEvent, Fragment, useCallback } from "react"
import { Table, Button, Form, Modal, Alert } from "react-bootstrap"
import Api from "./Api"
import LoggedInAppContext from "./LoggedInAppContext"
import User from "../shared/User"
import UserListResponse from "../shared/api/UserListResponse"
import Unauthorized from "../shared/api/Unauthorized"
import AccessDenied from "../shared/api/AccessDenied"
import Loading from "./Loading"
import moment from "moment"
import OverlayComponent from "./OverlayComponent"

interface Props {
   onClose: () => void,
}

interface AddingUserState {
   addingUser: boolean,
   email: string,
   isAdmin: boolean,
   validated: boolean,
   saving: boolean,
}

const UserList: React.FC<Props> = (props: Props) => {
   const context = useContext(LoggedInAppContext)
   const [users, setUsers] = useState({ users: new Array<User>(), message: "", confirmDeleteUser: "", deletingUser: "" })
   const [addingUserState, setAddingUserState] = useState<AddingUserState>({ addingUser: false, email: "", isAdmin: false, validated: false, saving: false })
   const token = context.token
   const onUnauthorized = context.logOut
   const mergeAddingUserState = (obj: any) => {
      setAddingUserState(s => { return { ...s, ...obj } })
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
      const form = event.currentTarget;

      event.preventDefault();
      event.stopPropagation();

      if (form.checkValidity()) {
         setAddingUserState(s => { return { ...s, saving: true } })

         var ret = await Api.addUser(token, new User({ email: addingUserState.email, isAdmin: addingUserState.isAdmin, id: "", lastLogin: 0, lastLoginDate: new Date() }));

         setAddingUserState(s => { return { ...s, addingUser: false } })

         handleUserListResponse(ret);
      }
      else {
         setAddingUserState(s => { return { ...s, validated: true } });
      }
   };
   const cancelAddUser = () => setAddingUserState(s => { return { ...s, addingUser: false } })
   useEffect(() => {
      async function getUsers() {
         var ret = await Api.users(token)

         handleUserListResponse(ret)
      }

      getUsers();
   }, [token, onUnauthorized, setUsers, handleUserListResponse])

   if (!users.users.length) {
      return <Loading />
   }

   return (
      <OverlayComponent onClose={props.onClose}>
         <Fragment>
            {addingUserState.addingUser &&
               <OverlayComponent onClose={cancelAddUser}>
                  <Form className="addUser" noValidate validated={addingUserState.validated} onSubmit={handleSubmit} onClick={(e: { target: any; currentTarget: any }) => { e.target === e.currentTarget && cancelAddUser() }}>
                     <Modal.Dialog>
                        <Modal.Header>
                           <Modal.Title>Add User</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                           <Form.Group controlId="formGroupEmail">
                              <Form.Label>Email address</Form.Label>
                              <Form.Control type="email" placeholder="Enter email" required autoFocus
                                 onChange={(e: FormEvent<HTMLInputElement>) => mergeAddingUserState({ email: e.currentTarget.value || "" })} />
                           </Form.Group>
                           <Form.Group controlId="formGroupIsAdmin">
                              <Form.Check type="checkbox" label="Is Admin?" onChange={(e: FormEvent<HTMLInputElement>) => mergeAddingUserState({ isAdmin: e.currentTarget.checked })} />
                           </Form.Group>
                        </Modal.Body>
                        <Modal.Footer>
                           {!addingUserState.saving ?
                              <Fragment>
                                 <Button variant="secondary" type="button" onClick={cancelAddUser}>Cancel</Button>
                                 <Button variant="primary" type="submit">Add User</Button>
                              </Fragment> :
                              <Loading text="Adding User..." />}
                        </Modal.Footer>
                     </Modal.Dialog>
                  </Form>
               </OverlayComponent>
            }
            <Table striped bordered hover style={{ backgroundColor: "white", }}>
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
                                 <Fragment>
                                    {u.id === users.confirmDeleteUser && users.deletingUser === u.id ?
                                       <Loading text="Deleting..." /> :
                                       u.id === users.confirmDeleteUser ?
                                          <Fragment>
                                             <Button variant="secondary" onClick={() => { setUsers(s => { return { ...s, confirmDeleteUser: "" } }) }}>Cancel</Button>&nbsp;
                                          <Button variant="danger" onClick={() => { setUsers(s => { return { ...s, deletingUser: u.id } }); Api.deleteUser(token, u.id).then(ret => handleUserListResponse(ret)) }}>Confirm Delete</Button>
                                          </Fragment> :
                                          <Button variant="danger" onClick={() => { setUsers(s => { return { ...s, confirmDeleteUser: u.id } }) }}>Delete</Button>
                                    }
                                 </Fragment> :
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
                           <Button variant="secondary" type="button" onClick={props.onClose}>Cancel</Button>
                           <Button variant="primary" type="submit" onClick={() => { setUsers(u => { return { ...u, message: "" } }); setAddingUserState({ addingUser: true, email: "", isAdmin: false, validated: false, saving: false }) }}>Add User</Button>
                        </div>
                     </td>
                  </tr>
               </tfoot>
            </Table>
         </Fragment>
      </OverlayComponent>
   )
}

export default UserList