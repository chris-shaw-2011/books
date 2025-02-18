import { NoopFunction, Token } from "@books/shared"
import { createContext, useCallback, useMemo, useState } from "react"
import { CookiesProvider, useCookies } from "react-cookie"

export type VisibleComponent = "Books" | "Settings" | "Users" | "ChangePassword" | "Upload"

interface AppContext {
	logOut: (message?: string) => void,
	searchWords: readonly string[],
	searchChanged: (e: React.ChangeEvent<HTMLInputElement>) => void,
	visibleComponent: VisibleComponent,
	setVisibleComponent: (component: VisibleComponent) => void,
	token?: Token | undefined,
	loginMessage: string,
	inviteUserId: string,
	onLogin: (t: Token) => void,
}

// TODO: get rid of default values here: https://stackoverflow.com/questions/61333188/react-typescript-avoid-context-default-value
const AppContext = createContext<AppContext>({
	logOut: NoopFunction,
	searchWords: [],
	searchChanged: NoopFunction,
	visibleComponent: "Books",
	setVisibleComponent: NoopFunction,
	loginMessage: "",
	inviteUserId: "",
	onLogin: NoopFunction,
})

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [loginMessage, setLoginMessage] = useState("")
	const [inviteUserId, setInviteUserId] = useState(window.location.pathname.includes("/invite/") ? window.location.pathname.replace("/invite/", "") : "")
	const [cookies, setCookies] = useCookies(["loginCookie"], { doNotParse: true })
	const [searchWords, setSearchWords] = useState<readonly string[]>([])
	const [visibleComponent, setVisibleComponent] = useState<VisibleComponent>("Books")
	const loginCookie = cookies.loginCookie as string | undefined
	const token = useMemo(() => {
		if (loginCookie) {
			return Token.fromJSON(loginCookie)
		}

		return undefined
	}, [loginCookie])
	const logOut = useCallback((message?: string) => {
		if (inviteUserId) {
			window.history.replaceState({}, document.title, "/")
			setInviteUserId("")
		}

		setCookies("loginCookie", "", { maxAge: 0, path: "/", sameSite: "strict" })
		setLoginMessage(message ?? "")
	}, [setCookies, setLoginMessage, inviteUserId])
	const searchChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const search = (e.currentTarget.value || "").trim()

		if (search) {
			setSearchWords(search.split(" ").map(w => w.toLowerCase()))
		}
		else {
			setSearchWords([])
		}
	}, [setSearchWords])
	const onLogin = useCallback((t: Token) => {
		if (inviteUserId) {
			window.history.replaceState({}, document.title, "/")
			setInviteUserId("")
		}
		setCookies("loginCookie", JSON.stringify(t), { maxAge: 12 * 30 * 24 * 60 * 60, path: "/", sameSite: "strict" })
		setLoginMessage("")
		setVisibleComponent("Books")
	}, [setCookies, setLoginMessage, inviteUserId])

	return (
		<CookiesProvider>
			<AppContext.Provider value={{ searchWords, searchChanged, visibleComponent, setVisibleComponent, logOut, token, loginMessage, inviteUserId, onLogin }}>
				{children}
			</AppContext.Provider>
		</CookiesProvider>
	)
}

export default AppContext