import { AccessDenied, ApiMessage, LoginRequest, SetPasswordRequest, Token, Unauthorized, UserRequest, UserResponse } from "@books/shared"
import BaseApi from "./BaseApi"

class ApiClass extends BaseApi {
	auth = async (email: string, password: string) => this.fetchWithType("/auth", Token, new LoginRequest({ email, password }))

	setPassword = async (newPassword: string, userId: string) => this.fetchWithType("/setPassword", Token, new SetPasswordRequest({ userId, newPassword }))

	user = async (userId: string) => this.fetch("/user", new UserRequest({ userId }))

	fetch = async (url: string, jsonSend?: unknown) => {
		const result = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: jsonSend ? JSON.stringify(jsonSend) : "",
		})
		const jsonRet = await result.json() as ApiMessage

		return this.parseJson(jsonRet)
	}

	parseJson(json?: ApiMessage) {
		if (!json) {
			return undefined
		}
		else if (json.type === "AccessDenied") {
			return new AccessDenied(json as AccessDenied)
		}
		else if (json.type === "Unauthorized") {
			return new Unauthorized(json as Unauthorized)
		}
		else if (json.type === "Token") {
			return new Token(json as Token)
		}
		else if (json.type === "UserResponse") {
			return new UserResponse(json as UserResponse)
		}
		else {
			throw Error(`Unknown ApiMessageType: ${json.type}`)
		}
	}
}

const Api = new ApiClass()

export default Api