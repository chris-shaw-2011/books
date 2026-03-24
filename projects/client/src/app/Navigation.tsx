import { lazy, Suspense, useContext, useState } from "react"
import DownArrow from "./svg/DownArrow"
import SelectList, { SelectListItem } from "./components/SelectList"
import styles from "./Navigation.module.scss"
import classnames from "classnames"
import useOnclickOutside from "react-cool-onclickoutside"
import Upload from "./svg/Upload"
import Lock from "./svg/Lock"
import LogOut from "./svg/LogOut"
import AppContext, { type VisibleComponent } from "./context/AppContext"
import Loading from "./Loading"
import { handleDynamicImportFailure } from "./shared/Methods"

const AdminNavOptions = lazy(() => import("./AdminNavOptions").catch(handleDynamicImportFailure))

const Navigation = () => {
	const [open, setOpen] = useState(false)
	const openClassName: Record<string, boolean> = {}
	const ref = useOnclickOutside(() => {
		setOpen(false)
	}, { disabled: !open })
	const appContext = useContext(AppContext)

	const setVisibleComponent = (e: React.MouseEvent<HTMLDivElement>, component: VisibleComponent) => {
		e.preventDefault()
		e.stopPropagation()
		setOpen(false)
		appContext.setVisibleComponent(component)
	}

	openClassName[styles.open] = open

	return (
		<div className={classnames(styles.downArrow, openClassName)} onClick={() => { setOpen(s => !s) }} ref={ref}>
			<DownArrow />
			<SelectList className={styles.navlist} open={open}>
				<SelectListItem onClick={e => { setVisibleComponent(e, "Upload") }}>
					<Upload />
					{" "}
					Upload Books
				</SelectListItem>
				{appContext.token?.user.isAdmin && (
					<Suspense fallback={<Loading />}>
						<AdminNavOptions setVisibleComponent={setVisibleComponent} />
					</Suspense>
				)}
				<hr />
				<SelectListItem onClick={e => { setVisibleComponent(e, "ChangePassword") }}>
					<Lock />
					{" "}
					Change Password
				</SelectListItem>
				<SelectListItem onClick={() => { appContext.logOut() }}>
					<LogOut />
					{" "}
					Log Out
				</SelectListItem>
			</SelectList>
		</div>
	)
}

export default Navigation
