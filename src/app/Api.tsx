import User from "../shared/User"
import Token from "../shared/api/Token";
import Books from "../shared/api/Books";
import ApiMessage, { ApiMessageType } from "../shared/api/ApiMessage";
import AccessDenied from "../shared/api/AccessDenied";
import Unauthorized from "../shared/api/Unauthorized";
import SettingsRequired from "../shared/api/SettingsRequired";
import SettingsUpdate from "../shared/api/SettingsUpdate";
import Settings from "../shared/Settings";
import SettingsUpdateResponse from "../shared/api/SettingsUpdateResponse";
import UserListResponse from "../shared/api/UserListResponse";
import AddUserRequest from "../shared/api/AddUserRequest";
import DeleteUserRequest from "../shared/api/DeleteUserRequest";
import ChangePasswordRequest from "../shared/api/ChangePasswordRequest";
import UserRequest from "../shared/api/UserRequest";
import UserResponse from "../shared/api/UserResponse";

class ApiClass {
   auth = async (email: string, password: string) => {
      var user = new User()

      user.email = email;
      user.password = password;

      return await this.fetch("/auth", user)
   }

   books = async (token: Token) => {
      return await this.fetch("/books", token)
   }

   updateSettings = async (token: Token, settings: Settings) => {
      return await this.fetch("/updateSettings", new SettingsUpdate({ type: ApiMessageType.SettingsUpdate, settings: settings, token: token }))
   }

   settings = async (token: Token) => {
      return await this.fetch("/settings", token)
   }

   users = async (token: Token) => {
      return await this.fetch("/users", token)
   }

   addUser = async (token: Token, user: User) => {
      return await this.fetch("/addUser", new AddUserRequest({ type: ApiMessageType.AddUserRequest, user: user, token: token }))
   }

   deleteUser = async (token: Token, userId: string) => {
      return await this.fetch("/deleteUser", new DeleteUserRequest({ type: ApiMessageType.DeleteUserRequest, userId: userId, token: token }))
   }

   changePassword = async (token: Token, newPassword: string) => {
      return await this.fetch("/changePassword", new ChangePasswordRequest({ type: ApiMessageType.ChangePasswordRequest, token: token, newPassword: newPassword }))
   }

   user = async (userId: string) => {
      return await this.fetch("/user", new UserRequest({ type: ApiMessageType.UserRequest, userId: userId }))
   }

   fetch = async (url: string, jsonSend?: any) => {
      var result = await fetch(url, {
         method: "POST",
         headers: {
            'Content-Type': 'application/json'
         },
         body: jsonSend ? JSON.stringify(jsonSend) : "",
      })
      var jsonRet = await result.json()

      return this.parseJson(jsonRet);
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
      else {
         throw Error(`Unknown ApiMessageType: ${json.type}`)
      }
   }
}

const Api = new ApiClass()

export default Api