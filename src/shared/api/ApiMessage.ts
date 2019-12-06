export enum ApiMessageType {
   Books,
   AccessDenied,
   Unauthorized,
   Token,
   SettingsRequired,
   SettingsUpdate,
   SettingsUpdateResponse,
   Settings,
}

export default class ApiMessage {
   type: ApiMessageType

   constructor(type: ApiMessageType) {
      this.type = type
   }
}