import { lazy, Suspense, useContext } from "react"
import LogIn from "./LogIn"
import styles from "./App.module.scss"
import Loading from "./Loading"
import AppContext, { AppContextProvider } from "./context/AppContext"
import Header from "./Header"
import { CookiesProvider } from "react-cookie"
import { handleDynamicImportFailure } from "./shared/Methods"

// TODO: add a separate check for SCSS module classes that are defined but never used
const Authenticated = lazy(() => import("./Authenticated").catch(handleDynamicImportFailure))
const SetPassword = lazy(() => import("./SetPassword").catch(handleDynamicImportFailure))

const MainContent = () => {
	const { token, logOut, inviteUserId } = useContext(AppContext)

	if (token) {
		return (
			<Suspense fallback={<Loading />}>
				<Authenticated token={token} />
			</Suspense>
		)
	}
	else if (inviteUserId) {
		return (
			<Suspense fallback={<Loading />}>
				<SetPassword onClose={logOut} />
			</Suspense>
		)
	}
	else {
		return (<LogIn />)
	}
}

const App = () => (
	<div className={styles.app}>
		<CookiesProvider>
			<AppContextProvider>
				<Header />
				<div className={styles.mainContent}>
					<MainContent />
				</div>
			</AppContextProvider>
		</CookiesProvider>
	</div>
)

export default App
