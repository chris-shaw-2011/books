import typia from "typia"
import RequestDeniedResponse from "./RequestDeniedResponse.ts"

export default class AccessDenied extends RequestDeniedResponse {
	readonly code = 403
	override readonly type = "AccessDenied"

	static fromUnknown(json: unknown) {
		return new AccessDenied(typia.assert<typia.Primitive<AccessDenied>>(json))
	}
}
