import * as shared from "@books/shared"
import BaseApi from "./BaseApi"

// TODO: split this up so it has an admin version and a non admin version
// TODO: this should inherit from Api.tsx
class LoggedInApiClass extends BaseApi {
	books = async (token: shared.Token) => this.fetch("/books", token)

	updateSettings = async (settings: shared.Settings) => this.fetch("/updateSettings", new shared.SettingsUpdate({ settings }))

	settings = async (token: shared.Token) => this.fetch("/settings", token)

	users = async () => this.fetch("/users")

	addUser = async (user: shared.User) => this.fetch("/addUser", new shared.AddUserRequest({ user }))

	deleteUser = async (userId: string) => this.fetch("/deleteUser", new shared.DeleteUserRequest({ userId }))

	changeBookStatus = async (bookId: string, status: shared.Status) => this.fetch("/changeBookStatus", new shared.ChangeBookStatusRequest({ bookId, status }))

	conversionUpdate = async (conversionId: string, knownPercent: number, knownConverterStatus: shared.ConverterStatus, knownWorkingFiles: string[], signal?: AbortSignal) =>
		this.fetch("/conversionUpdate", new shared.ConversionUpdateRequest({ conversionId, knownPercent, knownConverterStatus, knownWorkingFiles }), signal)

	updateBook = async (newBook: shared.Book, prevBook: shared.Book) => this.fetch("/updateBook", new shared.UpdateBookRequest({ newBook, prevBook }))

	addFolder = async (path: string, folderName: string) => this.fetch("/addFolder", new shared.AddFolderRequest({ path, folderName }))

	changePassword = async (newPassword: string) => this.fetchWithType("/changePassword", shared.Token, new shared.ChangePasswordRequest({ newPassword }))

	// TODO: update this method so it is a generic method where you specify the desired return type and update the jsonRet so it converts the result json to that type
	fetch = async (url: string, jsonSend?: unknown, signal?: AbortSignal) => {
		const headers = jsonSend ? { "Content-Type": "application/json" } : {}
		const result = await fetch(url, {
			method: "POST",
			headers: headers,
			body: jsonSend ? JSON.stringify(jsonSend) : "",
			signal: signal ?? null,
		})
		const jsonRet = await result.json() as shared.ApiMessage

		return this.parseJson(jsonRet)
	}

	// TODO: this should probably be moved to the ApiMessage class as a static function
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
		else if (json.type === "Books") {
			return new shared.Books(json as shared.Books)
		}
		else if (json.type === "SettingsRequired") {
			return new shared.SettingsRequired(json as shared.SettingsRequired)
		}
		else if (json.type === "SettingsUpdateResponse") {
			return new shared.SettingsUpdateResponse(json as shared.SettingsUpdateResponse)
		}
		else if (json.type === "UserListResponse") {
			return new shared.UserListResponse(json as shared.UserListResponse)
		}
		else if (json.type === "ConversionUpdateResponse") {
			return new shared.ConversionUpdateResponse(json as shared.ConversionUpdateResponse)
		}
		else if (json.type === "UploadResponse") {
			return new shared.UploadResponse(json as shared.UploadResponse)
		}
		else if (json.type === "UpdateBookResponse") {
			return new shared.UpdateBookResponse(json as shared.UpdateBookResponse)
		}
		else if (json.type === "AddUserResponse") {
			return new shared.AddUserResponse(json as shared.AddUserResponse)
		}
		else {
			throw Error(`Unknown ApiMessageType: ${json.type}`)
		}
	}
}

const LoggedInApi = new LoggedInApiClass()

export default LoggedInApi