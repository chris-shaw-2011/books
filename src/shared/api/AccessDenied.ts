import ApiMessage, { ApiMessageType } from "./ApiMessage"

export default class AccessDenied extends ApiMessage {
   message = ""

   constructor(json?: AccessDenied) {
      super(ApiMessageType.AccessDenied)

      if (json) {
         this.message = json.message
      }
   }
}
