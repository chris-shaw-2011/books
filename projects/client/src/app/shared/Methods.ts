import Cookies from "universal-cookie"

export const cookieName = "loginCookie"

export const handleDynamicImportFailure = (e: unknown) => {
	new Cookies().remove(cookieName)

	window.location.reload()

	throw e
}
