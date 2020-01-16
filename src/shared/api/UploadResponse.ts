import ApiMessage, { ApiMessageType } from "./ApiMessage"

export default class UploadResponse extends ApiMessage {
   conversionId = ""

   constructor(json?: UploadResponse) {
      super(ApiMessageType.UploadResponse)

      if (json) {
         this.conversionId = json.conversionId
      }
   }
}
