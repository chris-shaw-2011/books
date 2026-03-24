import { LoginRequest, SetPasswordRequest, Token, UserRequest, UserResponse } from "@books/shared"
import BaseApi from "./BaseApi"

export class ApiClass extends BaseApi {
	auth = async (email: string, password: string, onFailure: (message?: string) => void) => this.callApi("/auth", Token, onFailure, new LoginRequest({ email, password }))

	setPassword = async (newPassword: string, userId: string, onFailure: (message?: string) => void) => this.callApi("/setPassword", Token, onFailure, new SetPasswordRequest({ userId, newPassword }))

	user = async (userId: string, onFailure: (message?: string) => void) => this.callApi("/user", UserResponse, onFailure, new UserRequest({ userId }))
}

const Api = new ApiClass()

export default Api
