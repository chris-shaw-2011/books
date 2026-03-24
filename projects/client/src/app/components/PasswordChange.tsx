import { Alert } from "react-bootstrap"
import ActionButtons from "./ActionButtons"
import OverlayComponent from "./OverlayComponent"
import TextboxField from "./TextboxField"
import { Token, User } from "@books/shared"
import { useContext, useState } from "react"
import AppContext from "../context/AppContext"
import styles from "./PasswordChange.module.scss"

interface Props {
	onClose: () => void,
	user: User,
	actionButtonText: string,
	changeHappeningText: string,
	apiCall: (newPassword: string, userId: string, onFailure: (message?: string) => void) => Promise<Token>,
}

const PasswordChange = ({ onClose, user, actionButtonText, changeHappeningText, apiCall }: Props) => {
	const { onLogin, logOut } = useContext(AppContext)
	const [passwordsMatch, setPasswordsMatch] = useState(true)
	const [state, setState] = useState({ password: "", confirmedPassword: "", changingPasswords: false })
	const mergeState = (obj: Record<string, unknown>) => {
		setState(s => ({
			...s,
			...obj,
		}))
	}

	const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
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

				const ret = await apiCall(state.password, user.id, logOut)

				onLogin(ret)

				return
			}
		}
	}

	return (
		<OverlayComponent onClick={onClose}>
			<form className={styles.passwordChange} onSubmit={e => void handleSubmit(e)}>
				<div>
					<div className={styles.header}>{actionButtonText}</div>
					<div className={styles.body}>
						<label className={styles.email}>{user.email}</label>
						<TextboxField label="New Password" type="password" placeholder="New Password" required={true} onChange={e => { mergeState({ password: e.currentTarget.value || "" }) }} />
						<TextboxField label="Confirm New Password" type="password" placeholder="Confirm New Password" required={true} onChange={e => { mergeState({ confirmedPassword: e.currentTarget.value || "" }) }} />
						{!passwordsMatch && <Alert variant="danger">Passwords must match</Alert>}
					</div>
					<div className={styles.footer}>
						<ActionButtons onCancelClick={onClose} actionButtonText={actionButtonText} changeHappeningText={changeHappeningText} changeHappening={state.changingPasswords} />
					</div>
				</div>
			</form>
		</OverlayComponent>
	)
}

export default PasswordChange
