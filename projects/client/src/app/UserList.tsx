import moment from "dayjs"
import { useCallback, useContext, useEffect, useState } from "react"
import { Modal, ModalFooter, ModalTitle, Table } from "react-bootstrap"
import { UserListResponse, User, AddUserResponse } from "@books/shared"
import Loading from "./Loading"
import AppContext, { handleDynamicImportFailure } from "./context/AppContext"
import OverlayComponent from "./components/OverlayComponent"
import TextboxField from "./components/TextboxField"
import CheckboxField from "./components/CheckboxField"
import DeleteButton from "./components/DeleteButton"
import Alert from "./components/Alert"
import ModalDialog from "./components/ModalDialog"
import styles from "./UserList.module.scss"
import ActionButtons from "./components/ActionButtons"
import LoggedInAppContext from "./context/LoggedInAppContext"

const AdminApi = async () => (await import("./api/AdminApi").catch(handleDynamicImportFailure)).default

interface Props {
	onClose: () => void,
}

interface AddingUserState {
	email: string,
	isAdmin: boolean,
	status: AddingUserStatus,
	message: string,
}

interface UserActionsProps {
	loggedInUserId: string,
	user: User,
	logOut: (message?: string) => void,
	handleUserListResponse: (ret: UserListResponse | AddUserResponse) => void,
}

type UserStatus = "Active" | "ConfirmingDelete" | "Deleting"
type AddingUserStatus = "NotAdding" | "EnteringData" | "Saving"
const defaultAddingUserState: AddingUserState = { email: "", isAdmin: false, status: "NotAdding", message: "" }

const UserActions = ({ loggedInUserId, user, handleUserListResponse, logOut }: UserActionsProps) => {
	const [userStatus, setUserStatus] = useState<UserStatus>("Active")
	const confirmDeleteClicked = () => {
		setUserStatus("Deleting")
		const apiCall = async () => {
			const resp = await (await AdminApi()).deleteUser(user.id, logOut)

			handleUserListResponse(resp)
		}

		void apiCall()
	}

	if (user.id === loggedInUserId) {
		return "Cannot delete logged in user"
	}

	if (userStatus === "ConfirmingDelete" || userStatus === "Deleting") {
		return (
			<ActionButtons
				onCancelClick={() => setUserStatus("Active")}
				actionButtonText="Confirm Delete"
				actionButtonOnClick={confirmDeleteClicked}
				actionButtonType="DeleteButton"
				changeHappening={userStatus === "Deleting"}
				changeHappeningText="Deleting..."
			/>
		)
	}

	return <DeleteButton onClick={() => setUserStatus("ConfirmingDelete")} />
}

const UserList = (props: Props) => {
	const { logOut } = useContext(AppContext)
	const { token } = useContext(LoggedInAppContext)
	const [users, setUsers] = useState({ users: new Array<User>(), message: "" })
	const [addingUserState, setAddingUserState] = useState(defaultAddingUserState)
	const mergeAddingUserState = (obj: Partial<AddingUserState>) => {
		setAddingUserState(s => ({ ...s, ...obj }))
	}
	const handleUserListResponse = useCallback((ret: UserListResponse | AddUserResponse) => {
		setUsers({ users: ret.users, message: ret.message })
	}, [])
	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form.checkValidity()) {
			mergeAddingUserState({ status: "Saving" })

			const ret = await (await AdminApi()).addUser(new User({ email: addingUserState.email, isAdmin: addingUserState.isAdmin }), logOut)

			handleUserListResponse(ret)

			if (!ret.successful) {
				mergeAddingUserState({ message: ret.message, status: "EnteringData" })
			}
			else {
				setAddingUserState(defaultAddingUserState)
			}
		}
	}
	const cancelAddUser = () => setAddingUserState(defaultAddingUserState)
	useEffect(() => {
		async function getUsers() {
			const ret = await (await AdminApi()).users(logOut)

			handleUserListResponse(ret)
		}

		void getUsers()
	}, [token, logOut, setUsers, handleUserListResponse])

	if (!users.users.length) {
		return <Loading />
	}

	return (
		<OverlayComponent onClick={props.onClose}>
			<>
				{addingUserState.status !== "NotAdding" && (
					<OverlayComponent onClick={cancelAddUser}>
						<form onSubmit={e => void handleSubmit(e)}>
							<ModalDialog>
								<ModalTitle><Modal.Title>Add User</Modal.Title></ModalTitle>
								<Modal.Body className={styles.addUserBody}>
									<TextboxField
										label="Email address"
										type="email"
										placeholder="Enter email"
										required={true}
										autoFocus={true}
										onChange={e => { mergeAddingUserState({ email: e.currentTarget.value || "" }) }}
									/>
									<CheckboxField type="checkbox" label="Is Admin?" onChange={e => { mergeAddingUserState({ isAdmin: e.currentTarget.checked }) }} />
									{addingUserState.message && <Alert variant="primary">{addingUserState.message}</Alert>}
								</Modal.Body>
								<ModalFooter>
									<ActionButtons actionButtonText="AddUser" onCancelClick={cancelAddUser} changeHappeningText="Adding User..." changeHappening={addingUserState.status === "Saving"} />
								</ModalFooter>
							</ModalDialog>
						</form>
					</OverlayComponent>
				)}
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
						{users.users.map(u => (
							<tr key={u.id}>
								<td>{u.email}</td>
								<td>{u.isAdmin ? "Yes" : "No"}</td>
								<td>{u.lastLogin !== undefined ? moment(u.lastLogin).format("MM/D/YYYY, h:mm:ss a") : "Never"}</td>
								<td><UserActions loggedInUserId={token.user.id} user={u} handleUserListResponse={handleUserListResponse} logOut={logOut} /></td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<td colSpan={4}>
								{users.message && <Alert variant="primary">{users.message}</Alert>}
								<ActionButtons onCancelClick={props.onClose} actionButtonText="Add User" actionButtonOnClick={() => mergeAddingUserState({ status: "EnteringData" })} />
							</td>
						</tr>
					</tfoot>
				</Table>
			</>
		</OverlayComponent>
	)
}

export default UserList