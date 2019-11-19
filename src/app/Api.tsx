import User from "../shared/User"
import Token from "../shared/Token";
import Unauthorized from "../shared/Unauthorized";
import AccessDenied from "../shared/AccessDenied";
import Directory from "../shared/Directory";

class ApiClass {
   auth = async (email: string, password: string) => {
      var user = new User()

      user.email = email;
      user.password = password;

      return await this.fetch("/auth", Token, user)
   }

   books = async (token: Token) => {
      return await this.fetch("/books", Directory, token)
   }

   fetch = async <T extends {}>(url: string, type: (new (json?: any) => T), jsonSend?: any): Promise<T | Unauthorized | AccessDenied | undefined> => {
      var result = await fetch(url, {
         method: "POST",
         headers: {
            'Content-Type': 'application/json'
         },
         body: jsonSend ? JSON.stringify(jsonSend) : "",
      })
      var jsonRet = await result.json()

      if (result.ok) {
         return new type(jsonRet)
      }
      else if (result.status === 401) {
         return new Unauthorized(jsonRet)
      }
      else if (result.status === 403) {
         return new AccessDenied(jsonRet)
      }
   }
}

const Api = new ApiClass()

export default Api