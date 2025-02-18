import "bootstrap/dist/css/bootstrap.min.css"
import { lazy, Suspense, useContext } from "react"
import LogIn from "./LogIn"
import styles from "./App.module.scss"
import "./styles.scss"
import Loading from "./Loading"
import AppContext, { AppContextProvider } from "./context/AppContext"
import Header from "./Header"
import SetPassword from "./SetPassword"

// TODO: see if there is some way for the css modules to generate type definitions so it can be verified all modules are used

const Authenticated = lazy(() => import(/*
   webpackChunkName: "authenticated" */
	"./Authenticated"))

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
		return <SetPassword onClose={logOut} />
	}
	else {
		return (<LogIn />)
	}
}

const App = () => (
	<div className={styles.app}>
		<AppContextProvider>
			<Header />
			<div className={styles.mainContent}>
				<MainContent />
			</div>
		</AppContextProvider>
	</div>
)

export default App