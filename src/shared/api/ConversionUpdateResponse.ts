import ApiMessage, { ApiMessageType } from "./ApiMessage";
import { ConverterStatus } from "../ConverterStatus"

export default class ConversionUpdateResponse extends ApiMessage {
   conversionPercent = 0;
   errorMessage = ""
   converterStatus = ConverterStatus.Waiting

   constructor(json?: ConversionUpdateResponse) {
      super(ApiMessageType.ConversionUpdateResponse)

      if (json) {
         this.conversionPercent = json.conversionPercent
         this.errorMessage = json.errorMessage
         this.converterStatus = json.converterStatus
      }
   }
}