import ApiMessage from "./ApiMessage.ts"

export default abstract class RequestDeniedResponse extends ApiMessage {
	message: string
	abstract code: number

	constructor(value?: Partial<RequestDeniedResponse> | string) {
		super()

		if (typeof value === "string") {
			this.message = value
		}
		else {
			this.message = value?.message ?? ""
		}
	}

	toJSON() {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { code, ...json } = this

		return json
	}
}
