export default class Unauthorized {
   message = ""

   constructor(json?: Unauthorized) {
      if (json) {
         this.message = json.message
      }
   }
}