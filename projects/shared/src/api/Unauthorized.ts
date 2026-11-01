import typia from "typia"
import RequestDeniedResponse from "./RequestDeniedResponse.ts"

export default class Unauthorized extends RequestDeniedResponse {
	readonly code = 401
	override readonly type = "Unauthorized"

	static fromUnknown(json: unknown) {
		return new Unauthorized(typia.assert<typia.Primitive<Unauthorized>>(json))
	}
}
