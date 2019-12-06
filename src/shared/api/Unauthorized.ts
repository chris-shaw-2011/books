import ApiMessage, { ApiMessageType } from "./ApiMessage"

export default class Unauthorized extends ApiMessage {
   message = ""

   constructor(json?: Unauthorized) {
      super(ApiMessageType.Unauthorized)

      if (json) {
         this.message = json.message
      }
   }
}