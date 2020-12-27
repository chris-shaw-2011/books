import AccessDenied from "../../shared/api/AccessDenied"
import ApiMessage, { ApiMessageType } from "../../shared/api/ApiMessage"
import Token from "../../shared/api/Token"
import Unauthorized from "../../shared/api/Unauthorized"
import User from "../../shared/User"
import ChangePasswordRequest from "../../shared/api/ChangePasswordRequest"
import UserRequest from "../../shared/api/UserRequest"
import UserResponse from "../../shared/api/UserResponse"

class ApiClass {
   auth = async (email: string, password: string) => {
      const user = new User()

      user.email = email
      user.password = password

      return this.fetch("/auth", user)
   }

   changePassword = async (token: Token, newPassword: string) => {
      return this.fetch("/changePassword", new ChangePasswordRequest({ type: ApiMessageType.ChangePasswordRequest, token, newPassword }))
   }

   user = async (userId: string) => {
      return this.fetch("/user", new UserRequest({ type: ApiMessageType.UserRequest, userId }))
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
      if (!json) {
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
