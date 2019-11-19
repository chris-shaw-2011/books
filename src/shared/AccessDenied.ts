export default class AccessDenied {
   message = ""

   constructor(json?: AccessDenied) {
      if (json) {
         this.message = json.message
      }
   }
}