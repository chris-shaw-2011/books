import { useState } from "react"
import Alert from "./components/Alert"
import { Token, AccessDenied, Unauthorized } from "@books/shared"
import Api from "./api/Api"
import Loading from "./Loading"
import TextboxField from "./components/TextboxField"
import OkButton from "./components/OkButton"
import styles from "./Login.module.scss"

interface Props {
	onAuthenticated: (token: Token) => void,
	message?: string,
}

const LogIn = (props: Props) => {
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [logInState, setLogInState] = useState({ loggingIn: false, failedMessage: "" })
	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form.checkValidity()) {
			setLogInState({ loggingIn: true, failedMessage: "" })
			const ret = await Api.auth(email, password)

			if (ret instanceof Token) {
				props.onAuthenticated(ret)
				return
			}
			else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
				setLogInState({ loggingIn: false, failedMessage: ret.message })
			}
			else {
				setLogInState({ loggingIn: false, failedMessage: "Something unexpected happened" })
			}
		}
	}

	return (
		<form className={styles.logIn} onSubmit={e => void handleSubmit(e)}>
			<div>
				<div className={styles.header}>Log In</div>
				<div className={styles.body}>
					{logInState.failedMessage ? <Alert variant="danger">{logInState.failedMessage}</Alert> : props.message ? <Alert variant="danger">{props.message}</Alert> : null}
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