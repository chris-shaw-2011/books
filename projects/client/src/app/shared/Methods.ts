import Cookies from "universal-cookie"

export const cookieName = "loginCookie"

export const formatDateTime = (date: Date) => {
	const month = date.getMonth() + 1
	const hours = date.getHours()
	const period = hours < 12 ? "AM" : "PM"
	const datePart = `${month}/${date.getDate()}/${date.getFullYear()}`
	const timePart = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}:${(date.getSeconds()).toLocaleString().padStart(2, "0")} ${period}`

	return `${datePart} ${timePart}`
}

export const handleDynamicImportFailure = (e: unknown) => {
	new Cookies().remove(cookieName)

	window.location.reload()

	throw e
}
