import RequestDeniedResponse from "./RequestDeniedResponse.ts"

export default class AccessDenied extends RequestDeniedResponse {
	readonly code = 403
	override readonly type = "AccessDenied"
}