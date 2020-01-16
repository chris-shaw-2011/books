import AccessDenied from "../shared/api/AccessDenied"
import AddUserRequest from "../shared/api/AddUserRequest"
import ApiMessage, { ApiMessageType } from "../shared/api/ApiMessage"
import Books from "../shared/api/Books"
import ChangeBookStatusRequest from "../shared/api/ChangeBookStatusRequest"
import ChangePasswordRequest from "../shared/api/ChangePasswordRequest"
import ConversionUpdateRequest from "../shared/api/ConversionUpdateRequest"
import ConversionUpdateResponse from "../shared/api/ConversionUpdateResponse"
import DeleteUserRequest from "../shared/api/DeleteUserRequest"
import SettingsRequired from "../shared/api/SettingsRequired"
import SettingsUpdate from "../shared/api/SettingsUpdate"
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse"
import Token from "../shared/api/Token"
import Unauthorized from "../shared/api/Unauthorized"
import UploadResponse from "../shared/api/UploadResponse"
import UserListResponse from "../shared/api/UserListResponse"
import UserRequest from "../shared/api/UserRequest"
import UserResponse from "../shared/api/UserResponse"
import { Status } from "../shared/Book"
import { ConverterStatus } from "../shared/ConverterStatus"
import Settings from "../shared/Settings"
import User from "../shared/User"

class ApiClass {
   auth = async (email: string, password: string) => {
      const user = new User()

      user.email = email
      user.password = password

      return await this.fetch("/auth", user)
   }

   books = async (token: Token) => {
      return await this.fetch("/books", token)
   }

   updateSettings = async (token: Token, settings: Settings) => {
      return await this.fetch("/updateSettings", new SettingsUpdate({ type: ApiMessageType.SettingsUpdate, settings, token }))
   }

   settings = async (token: Token) => {
      return await this.fetch("/settings", token)
   }

   users = async (token: Token) => {
      return await this.fetch("/users", token)
   }

   addUser = async (token: Token, user: User) => {
      return await this.fetch("/addUser", new AddUserRequest({ type: ApiMessageType.AddUserRequest, user, token }))
   }

   deleteUser = async (token: Token, userId: string) => {
      return await this.fetch("/deleteUser", new DeleteUserRequest({ type: ApiMessageType.DeleteUserRequest, userId, token }))
   }

   changePassword = async (token: Token, newPassword: string) => {
      return await this.fetch("/changePassword", new ChangePasswordRequest({ type: ApiMessageType.ChangePasswordRequest, token, newPassword }))
   }

   user = async (userId: string) => {
      return await this.fetch("/user", new UserRequest({ type: ApiMessageType.UserRequest, userId }))
   }

   changeBookStatus = async (bookId: string, status: Status, token: Token) => {
      return await this.fetch("/changeBookStatus", new ChangeBookStatusRequest({ bookId, status, token, type: ApiMessageType.ChangeBookStatusRequest }))
   }

   conversionUpdate = async (conversionId: string, knownPercent: number, knownConverterStatus: ConverterStatus) => {
      return await this.fetch("/conversionUpdate", new ConversionUpdateRequest({ type: ApiMessageType.ConversionUpdateRequest, conversionId, knownPercent, knownConverterStatus }))
   }

   fetch = async (url: string, jsonSend?: any) => {
      const result = await fetch(url, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: jsonSend ? JSON.stringify(jsonSend) : "",
      })
      const jsonRet = await result.json()

      return this.parseJson(jsonRet)
   }

   parseJson(json?: ApiMessage) {
      if (!json || json.type === undefined) {
         return undefined
      }
      else if (json.type === ApiMessageType.AccessDenied) {
         return new AccessDenied(json as AccessDenied)
      }
      else if (json.type === ApiMessageType.Unauthorized) {
         return new Unauthorized(json as Unauthorized)
      }
      else if (json.type === ApiMessageType.Token) {
         return new Token(json as Token)
      }
      else if (json.type === ApiMessageType.Books) {
         return new Books(json as Books)
      }
      else if (json.type === ApiMessageType.SettingsRequired) {
         return new SettingsRequired(json as SettingsRequired)
      }
      else if (json.type === ApiMessageType.SettingsUpdateResponse) {
         return new SettingsUpdateResponse(json as SettingsUpdateResponse)
      }
      else if (json.type === ApiMessageType.UserListResponse) {
         return new UserListResponse(json as UserListResponse)
      }
      else if (json.type === ApiMessageType.UserResponse) {
         return new UserResponse(json as UserResponse)
      }
      else if (json.type === ApiMessageType.ConversionUpdateResponse) {
         return new ConversionUpdateResponse(json as ConversionUpdateResponse)
      }
      else if (json.type === ApiMessageType.UploadResponse) {
         return new UploadResponse(json as UploadResponse)
      }
      else {
         throw Error(`Unknown ApiMessageType: ${json.type}`)
      }
   }
}

export default new ApiClass()
