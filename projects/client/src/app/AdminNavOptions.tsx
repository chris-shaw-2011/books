import { SelectListItem } from "./components/SelectList"
import Gear from "./svg/Gear"
import Users from "./svg/Users"
import { type VisibleComponent } from "./context/AppContext"

interface AdminNavOptionsProps {
	setVisibleComponent: (e: React.MouseEvent<HTMLDivElement>, component: VisibleComponent) => void,
}

const AdminNavOptions = ({ setVisibleComponent }: AdminNavOptionsProps) => (
	<>
		<SelectListItem onClick={e => { setVisibleComponent(e, "Users") }}>
			<Users />
			{" "}
			Manage Users
		</SelectListItem>
		<SelectListItem onClick={e => { setVisibleComponent(e, "Settings") }}>
			<Gear />
			{" "}
			Settings
		</SelectListItem>
	</>
)

export default AdminNavOptions