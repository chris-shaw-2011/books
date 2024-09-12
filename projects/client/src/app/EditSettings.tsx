import { useContext, useEffect, useState } from "react"
import { Modal } from "react-bootstrap"
import Alert from "./components/Alert"
import { AccessDenied, SettingsRequired, SettingsUpdateResponse, Unauthorized, Settings } from "@books/shared"
import Api from "./api/LoggedInApi"
import Loading from "./Loading"
import AppContext from "./LoggedInAppContext"
import OverlayComponent from "./components/OverlayComponent"
import TextboxField from "./components/TextboxField"
import CancelButton from "./components/CancelButton"
import OkButton from "./components/OkButton"
import ModalDialog from "./components/ModalDialog"

interface Props {
	onSettingsSaved: () => void,
	message?: string,
	onClose?: () => void,
}

const EditSettings = (props: Props) => {
	const [settings, setSettings] = useState<Settings | undefined>()
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState(props.message)
	const context = useContext(AppContext)
	const onUnauthorized = context.logOut
	const token = context.token
	const onChange = (obj: Record<string, unknown>) => {
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

		void getSettings()
	}, [onUnauthorized, token])

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>, settings: Settings) => {
		setSaving(true)
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form.checkValidity()) {
			const ret = await Api.updateSettings(token, settings)

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
				<form onSubmit={e => void handleSubmit(e, settings)}>
					<ModalDialog>
						<Modal.Header>
							<Modal.Title>Settings</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							{message ? <Alert variant="danger">{message}</Alert> : null}
							<TextboxField label="Base Books Path" type="text" placeholder="Enter Base Path" required={true} defaultValue={settings.baseBooksPath}
								onChange={e => { onChange({ baseBooksPath: e.currentTarget.value || "" }) }}
							/>
							<TextboxField label="Upload Location" type="text" placeholder="Enter Upload Location" required={true} defaultValue={settings.uploadLocation}
								onChange={e => { onChange({ uploadLocation: e.currentTarget.value || "" }) }}
							/>
							<TextboxField label="Invite Email Address" type="email" placeholder="Enter Invite Email Address" required={true} defaultValue={settings.inviteEmail}
								onChange={e => { onChange({ inviteEmail: e.currentTarget.value || "" }) }}
							/>
							<TextboxField label="Invite Email Address" type="password" placeholder="Enter Invite Email Password" required={true} defaultValue={settings.inviteEmailPassword}
								onChange={e => { onChange({ inviteEmailPassword: e.currentTarget.value || "" }) }}
							/>
						</Modal.Body>
						<Modal.Footer>
							{!saving ?
								<>
									{props.onClose && <CancelButton onClick={props.onClose} />}
									<OkButton type="submit" value="Save" />
								</> : <Loading text="Saving..." />}
						</Modal.Footer>
					</ModalDialog>
				</form >
			</OverlayComponent >
		)
	}
	else {
		return <Loading />
	}
}

export default EditSettings