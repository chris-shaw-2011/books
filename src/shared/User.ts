export default class User {
   email: string = ""
   password?: string
   id: string = ""
   isAdmin: boolean = false

   constructor(json?: User) {
      if (json) {
         this.email = json.email
         this.password = json.password
         this.id = json.id
         this.isAdmin = json.isAdmin
      }
   }
}