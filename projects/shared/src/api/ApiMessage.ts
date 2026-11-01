import { type ApiMessageType } from "./ApiMessageType.ts"

export default abstract class ApiMessage {
	readonly abstract type: ApiMessageType

	protected assignDefined<T extends ApiMessage>(this: T, source: Partial<T>) {
		for (const key in source) {
			const value = source[key]
			if (value !== undefined) this[key] = value
		}
	}
}
