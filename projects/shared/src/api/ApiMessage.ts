import { type ApiMessageType } from "./ApiMessageType.ts"

export default abstract class ApiMessage {
	readonly abstract type: ApiMessageType
}
