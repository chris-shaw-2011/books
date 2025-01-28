import * as shared from "@books/shared"

class ApiClass {
	auth = async (email: string, password: string) => {
		const user = new shared.User()

		user.email = email
		user.password = password

		return this.fetch("/auth", user)
	}

	changePassword = async (newPassword: string) => {
		return this.fetch("/changePassword", new shared.ChangePasswordRequest({ newPassword }))
	}

	user = async (userId: string) => {
		return this.fetch("/user", new shared.UserRequest({ userId }))
	}

	fetch = async (url: string, jsonSend?: unknown) => {
		const result = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: jsonSend ? JSON.stringify(jsonSend) : "",
		})
		const jsonRet = await result.json() as shared.ApiMessage

		return this.parseJson(jsonRet)
	}

	parseJson(json?: shared.ApiMessage) {
		if (!json) {
			return undefined
		}
		else if (json.type === "AccessDenied") {
			return new shared.AccessDenied(json as shared.AccessDenied)
		}
		else if (json.type === "Unauthorized") {
			return new shared.Unauthorized(json as shared.Unauthorized)
		}
		else if (json.type === "Token") {
			return new shared.Token(json as shared.Token)
		}
		else if (json.type === "UserResponse") {
			return new shared.UserResponse(json as shared.UserResponse)
		}
		else {
			throw Error(`Unknown ApiMessageType: ${json.type}`)
		}
	}
}

const Api = new ApiClass()

export default Api
