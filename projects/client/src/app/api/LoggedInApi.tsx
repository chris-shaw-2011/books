import * as shared from "@books/shared"

class LoggedInApiClass {
	books = async (token: shared.Token) => {
		return this.fetch("/books", token)
	}

	updateSettings = async (settings: shared.Settings) => {
		return this.fetch("/updateSettings", new shared.SettingsUpdate({ settings }))
	}

	settings = async (token: shared.Token) => {
		return this.fetch("/settings", token)
	}

	users = async () => {
		return this.fetch("/users")
	}

	addUser = async (user: shared.User) => {
		return this.fetch("/addUser", new shared.AddUserRequest({ user }))
	}

	deleteUser = async (userId: string) => {
		return this.fetch("/deleteUser", new shared.DeleteUserRequest({ userId }))
	}

	changeBookStatus = async (bookId: string, status: shared.Status) => {
		return this.fetch("/changeBookStatus", new shared.ChangeBookStatusRequest({ bookId, status }))
	}

	conversionUpdate = async (conversionId: string, knownPercent: number, knownConverterStatus: shared.ConverterStatus) => {
		return this.fetch("/conversionUpdate", new shared.ConversionUpdateRequest({ conversionId, knownPercent, knownConverterStatus }))
	}

	updateBook = async (newBook: shared.Book, prevBook: shared.Book) => {
		return this.fetch("/updateBook", new shared.UpdateBookRequest({ newBook, prevBook }))
	}

	addFolder = async (path: string, folderName: string) => {
		return this.fetch("/addFolder", new shared.AddFolderRequest({ path, folderName }))
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
		else {
			throw Error(`Unknown ApiMessageType: ${json.type}`)
		}
	}
}

const LoggedInApi = new LoggedInApiClass()

export default LoggedInApi
