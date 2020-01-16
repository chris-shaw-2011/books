export default class User {
   email: string = ""
   password?: string
   id: string = ""
   isAdmin: boolean = false
   lastLogin: number = 0

   get lastLoginDate() {
      return new Date(this.lastLogin)
   }

   constructor(json?: User) {
      if (json) {
         this.email = json.email
         this.password = json.password
         this.id = json.id
         this.isAdmin = json.isAdmin
         this.lastLogin = json.lastLogin
      }
   }
}
