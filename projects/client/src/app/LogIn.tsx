import { useContext, useState } from "react"
import Alert from "./components/Alert"
import Api from "./api/Api"
import Loading from "./Loading"
import TextboxField from "./components/TextboxField"
import OkButton from "./components/OkButton"
import styles from "./Login.module.scss"
import AppContext from "./context/AppContext"

const LogIn = () => {
	const { onLogin, loginMessage } = useContext(AppContext)
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [logInState, setLogInState] = useState({ loggingIn: false, failedMessage: "" })
	const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form.checkValidity()) {
			setLogInState({ loggingIn: true, failedMessage: "" })
			const ret = await Api.auth(email, password, m => setLogInState({ loggingIn: false, failedMessage: m ?? "" }))

			onLogin(ret)
		}
	}

	return (
		<form className={styles.logIn} onSubmit={e => void handleSubmit(e)}>
			<div>
				<div className={styles.header}>Log In</div>
				<div className={styles.body}>
					{logInState.failedMessage ? <Alert variant="danger">{logInState.failedMessage}</Alert> : loginMessage ? <Alert variant="danger">{loginMessage}</Alert> : null}
					<TextboxField label="Email address" type="email" placeholder="Enter email" required={true} onChange={e => { setEmail(e.currentTarget.value) }} autoFocus={true} />
					<TextboxField label="Password" type="password" placeholder="Password" required={true} onChange={e => { setPassword(e.currentTarget.value || "") }} />
				</div>
				<div className={styles.footer}>
					{!logInState.loggingIn ? <OkButton value="Log In" /> : <Loading text="Logging In..." />}
				</div>
			</div>
		</form>
	)
}

export default LogIn
