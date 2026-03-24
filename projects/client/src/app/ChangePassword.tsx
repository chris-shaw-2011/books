import { useContext } from "react"
import LoggedInApi from "./api/LoggedInApi"
import PasswordChange from "./components/PasswordChange"
import LoggedInAppContext from "./context/LoggedInAppContext"

interface Props {
	onClose: () => void,
}

const ChangePassword = ({ onClose }: Props) => {
	const { token } = useContext(LoggedInAppContext)
	const apiCallWrapper = async (newPassword: string, _: string, onFailure: (message?: string) => void) => await LoggedInApi.changePassword(newPassword, onFailure)

	return (
		<PasswordChange onClose={onClose} user={token.user} actionButtonText="Change Password" changeHappeningText="Changing Password" apiCall={apiCallWrapper} />
	)
}

export default ChangePassword
