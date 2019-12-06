export default class Settings {
   baseBooksPath: string = "";

   constructor(json?: Settings) {
      if (json) {
         this.baseBooksPath = json.baseBooksPath
      }
   }
}