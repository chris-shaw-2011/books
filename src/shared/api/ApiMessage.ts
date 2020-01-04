export enum ApiMessageType {
   Books,
   AccessDenied,
   Unauthorized,
   Token,
   SettingsRequired,
   SettingsUpdate,
   SettingsUpdateResponse,
   Settings,
   UserListResponse,
   AddUserRequest,
   DeleteUserRequest,
   ChangePasswordRequest,
   UserRequest,
   UserResponse,
   ChangeBookStatusRequest,
   ConversionUpdateRequest,
   ConversionUpdateResponse,
   UploadResponse,
}

export default class ApiMessage {
   type: ApiMessageType

   constructor(type: ApiMessageType) {
      this.type = type
   }
}