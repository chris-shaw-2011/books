import { useContext, useEffect, useState } from "react"
import { AccessDenied, Unauthorized, UserResponse } from "@books/shared"
import Api from "./api/Api"
import Loading from "./Loading"
import AppContext from "./context/AppContext"
import PasswordChange from "./components/PasswordChange"

interface Props {
	onClose: () => void,
}

const SetPassword = ({ onClose }: Props) => {
	const { token, logOut, inviteUserId } = useContext(AppContext)
	const [user, setUser] = useState(token ? token.user : undefined)

	useEffect(() => {
		async function getUser() {
			const ret = await Api.user(inviteUserId)

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

		void getUser()
	}, [logOut, inviteUserId])

	if (!user) {
		return <Loading />
	}
	else {
		return (
			<PasswordChange onClose={onClose} user={user} actionButtonText="Set Password" changeHappeningText="Setting Password" apiCall={Api.setPassword} />
		)
	}
}

export default SetPassword