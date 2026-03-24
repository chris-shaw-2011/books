import { AddFolderRequest, AddUserRequest, AddUserResponse, Book, Books, DeleteUserRequest, Settings, SettingsRequired, SettingsUpdate, SettingsUpdateResponse, UpdateBookRequest, UpdateBookResponse, User, UserListResponse } from "@books/shared"
import { LoggedInApiClass } from "./LoggedInApi"

class AdminApiClass extends LoggedInApiClass {
	updateSettings = async (settings: Settings, onFailure: (message?: string) => void) => await this.callApi("/updateSettings", SettingsUpdateResponse, onFailure, new SettingsUpdate({ settings }))

	settings = async (onFailure: (message?: string) => void) => await this.callApi("/settings", SettingsRequired, onFailure)

	users = async (onFailure: (message?: string) => void) => await this.callApi("/users", UserListResponse, onFailure)

	addUser = async (user: User, onFailure: (message?: string) => void) => await this.callApi("/addUser", AddUserResponse, onFailure, new AddUserRequest({ user }))

	deleteUser = async (userId: string, onFailure: (message?: string) => void) => await this.callApi("/deleteUser", UserListResponse, onFailure, new DeleteUserRequest({ userId }))

	updateBook = async (newBook: Book, prevBook: Book, onFailure: (message?: string) => void) => await this.callApi("/updateBook", UpdateBookResponse, onFailure, new UpdateBookRequest({ newBook, prevBook }))

	addFolder = async (path: string, folderName: string, onFailure: (message?: string) => void) => await this.callApi("/addFolder", Books, onFailure, new AddFolderRequest({ path, folderName }))
}

const AdminApi = new AdminApiClass()

export default AdminApi
