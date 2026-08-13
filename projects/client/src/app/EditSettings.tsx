import { useContext, useEffect, useState } from "react"
import Alert from "./components/Alert"
import { Settings, NoopFunction } from "@books/shared"
import Loading from "./Loading"
import LoggedInAppContext from "./context/LoggedInAppContext"
import OverlayComponent from "./components/OverlayComponent"
import TextboxField from "./components/TextboxField"
import ModalDialog, { ModalBody, ModalFooter, ModalHeader, ModalTitle } from "./components/ModalDialog"
import ActionButtons from "./components/ActionButtons"
import AppContext from "./context/AppContext"
import { handleDynamicImportFailure } from "./shared/Methods"

const AdminApi = async () => (await import("./api/AdminApi").catch(handleDynamicImportFailure)).default

interface Props {
	onSettingsSaved: () => void,
	message?: string,
	onClose?: () => void,
}

const EditSettings = (props: Props) => {
	const [settings, setSettings] = useState<Settings | undefined>()
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState(props.message)
	const { logOut } = useContext(AppContext)
	const { token } = useContext(LoggedInAppContext)
	const onChange = (obj: Partial<Settings>) => {
		setSettings(s => new Settings({
			baseBooksPath: s?.baseBooksPath ?? "",
			inviteEmail: s?.inviteEmail ?? "",
			inviteEmailPassword: s?.inviteEmailPassword ?? "",
			uploadLocation: s?.uploadLocation ?? "",
			...obj,
		}))
	}

	useEffect(() => {
		async function getSettings() {
			const ret = await (await AdminApi()).settings(logOut)

			setSettings(ret.settings)
		}

		void getSettings()
	}, [logOut, token])

	const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>, settings: Settings) => {
		setSaving(true)
		const form = event.currentTarget

		event.preventDefault()
		event.stopPropagation()

		if (form.checkValidity()) {
			const ret = await (await AdminApi()).updateSettings(settings, logOut)

			if (ret.successful) {
				props.onSettingsSaved()
				return
			}
			else {
				setMessage(ret.message)
			}
		}

		setSaving(false)
	}

	if (!settings) {
		return (
			<OverlayComponent onClick={props.onClose}>
				<Loading />
			</OverlayComponent>
		)
	}

	return (
		<OverlayComponent onClick={props.onClose}>
			<form onSubmit={e => void handleSubmit(e, settings)}>
				<ModalDialog>
					<ModalHeader>
						<ModalTitle>Settings</ModalTitle>
					</ModalHeader>
					<ModalBody>
						{message ? <Alert variant="danger">{message}</Alert> : null}
						<TextboxField
							label="Base Books Path"
							type="text"
							placeholder="Enter Base Path"
							required={true}
							defaultValue={settings.baseBooksPath}
							onChange={e => onChange({ baseBooksPath: e.currentTarget.value || "" })}
						/>
						<TextboxField
							label="Upload Location"
							type="text"
							placeholder="Enter Upload Location"
							required={true}
							defaultValue={settings.uploadLocation}
							onChange={e => onChange({ uploadLocation: e.currentTarget.value || "" })}
						/>
						<TextboxField
							label="Invite Email Address"
							type="email"
							placeholder="Enter Invite Email Address"
							required={true}
							defaultValue={settings.inviteEmail}
							onChange={e => onChange({ inviteEmail: e.currentTarget.value || "" })}
						/>
						<TextboxField
							label="Invite Email Address Password"
							type="password"
							placeholder="Enter Invite Email Password"
							required={true}
							defaultValue={settings.inviteEmailPassword}
							onChange={e => onChange({ inviteEmailPassword: e.currentTarget.value || "" })}
						/>
					</ModalBody>
					<ModalFooter>
						<ActionButtons onCancelClick={props.onClose ?? NoopFunction} actionButtonText="Save" changeHappening={saving} changeHappeningText="Saving..." />
					</ModalFooter>
				</ModalDialog>
			</form>
		</OverlayComponent>
	)
}

export default EditSettings
