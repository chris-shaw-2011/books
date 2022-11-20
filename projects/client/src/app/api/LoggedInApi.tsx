import * as shared from "@books/shared"

class LoggedInApiClass {
	books = async (token: shared.Token) => {
		return this.fetch("/books", token)
	}

	updateSettings = async (token: shared.Token, settings: shared.Settings) => {
		return this.fetch("/updateSettings", new shared.SettingsUpdate({ type: shared.ApiMessageType.SettingsUpdate, settings, token }))
	}

	settings = async (token: shared.Token) => {
		return this.fetch("/settings", token)
	}

	users = async (token: shared.Token) => {
		return this.fetch("/users", token)
	}

	addUser = async (token: shared.Token, user: shared.User) => {
		return this.fetch("/addUser", new shared.AddUserRequest({ type: shared.ApiMessageType.AddUserRequest, user, token }))
	}

	deleteUser = async (token: shared.Token, userId: string) => {
		return this.fetch("/deleteUser", new shared.DeleteUserRequest({ type: shared.ApiMessageType.DeleteUserRequest, userId, token }))
	}

	changeBookStatus = async (bookId: string, status: shared.Status, token: shared.Token) => {
		return this.fetch("/changeBookStatus", new shared.ChangeBookStatusRequest({ bookId, status, token, type: shared.ApiMessageType.ChangeBookStatusRequest }))
	}

	conversionUpdate = async (conversionId: string, knownPercent: number, knownConverterStatus: shared.ConverterStatus) => {
		return this.fetch("/conversionUpdate", new shared.ConversionUpdateRequest({ type: shared.ApiMessageType.ConversionUpdateRequest, conversionId, knownPercent, knownConverterStatus }))
	}

	updateBook = async (token: shared.Token, newBook: shared.Book, prevBook: shared.Book) => {
		return this.fetch("/updateBook", new shared.UpdateBookRequest({ type: shared.ApiMessageType.UpdateBookRequest, newBook, prevBook, token }))
	}

	addFolder = async (token: shared.Token, path: string, folderName: string) => {
		return this.fetch("/addFolder", new shared.AddFolderRequest({ type: shared.ApiMessageType.AddFolderRequest, token, path, folderName }))
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
		else if (json.type === shared.ApiMessageType.AccessDenied) {
			return new shared.AccessDenied(json as shared.AccessDenied)
		}
		else if (json.type === shared.ApiMessageType.Unauthorized) {
			return new shared.Unauthorized(json as shared.Unauthorized)
		}
		else if (json.type === shared.ApiMessageType.Token) {
			return new shared.Token(json as shared.Token)
		}
		else if (json.type === shared.ApiMessageType.Books) {
			return new shared.Books(json as shared.Books)
		}
		else if (json.type === shared.ApiMessageType.SettingsRequired) {
			return new shared.SettingsRequired(json as shared.SettingsRequired)
		}
		else if (json.type === shared.ApiMessageType.SettingsUpdateResponse) {
			return new shared.SettingsUpdateResponse(json as shared.SettingsUpdateResponse)
		}
		else if (json.type === shared.ApiMessageType.UserListResponse) {
			return new shared.UserListResponse(json as shared.UserListResponse)
		}
		else if (json.type === shared.ApiMessageType.ConversionUpdateResponse) {
			return new shared.ConversionUpdateResponse(json as shared.ConversionUpdateResponse)
		}
		else if (json.type === shared.ApiMessageType.UploadResponse) {
			return new shared.UploadResponse(json as shared.UploadResponse)
		}
		else if (json.type === shared.ApiMessageType.UpdateBookResponse) {
			return new shared.UpdateBookResponse(json as shared.UpdateBookResponse)
		}
		else {
			throw Error(`Unknown ApiMessageType: ${json.type}`)
		}
	}
}

const LoggedInApi = new LoggedInApiClass()

export default LoggedInApi
