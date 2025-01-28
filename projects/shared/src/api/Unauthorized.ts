import RequestDeniedResponse from "./RequestDeniedResponse.js"

export default class Unauthorized extends RequestDeniedResponse {
	readonly code = 401
	override readonly type = "Unauthorized"
}
