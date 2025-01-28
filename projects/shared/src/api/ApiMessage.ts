import { type ApiMessageType } from "./ApiMessageType.js"

export default abstract class ApiMessage {
	readonly abstract type: ApiMessageType
}
