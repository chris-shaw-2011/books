import { lazy, Suspense, useContext } from "react"
import AppContext, { handleDynamicImportFailure } from "./context/AppContext"
import styles from "./Header.module.scss"
import Textbox from "./components/Textbox"

const Navigation = lazy(() => import("./Navigation").catch(handleDynamicImportFailure))

const Header = () => {
	const appContext = useContext(AppContext)

	return (
		<div className={styles.header}>
			<img src="favicon.svg" alt="Book" />
			<h1>Audio Books</h1>
			<hr />
			{appContext.token && (
				<>
					<Textbox placeholder="Search" onChange={appContext.searchChanged} type="search" />
					<Suspense fallback={<div />}>
						<Navigation />
					</Suspense>
				</>
			)}
		</div>
	)
}

export default Header