import RequestDeniedResponse from "./RequestDeniedResponse.js"

export default class AccessDenied extends RequestDeniedResponse {
	readonly code = 403
	override readonly type = "AccessDenied"
}