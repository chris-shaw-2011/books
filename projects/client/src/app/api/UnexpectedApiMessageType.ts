import type { ApiMessageType } from "@books/shared"

export default class UnexpectedApiMessageType {
	receivedType: string
	expectedType: ApiMessageType

	get message() {
		return `Unexpected response received, expected: ${this.expectedType}, received: ${this.receivedType}`
	}

	constructor(receivedType: string, expectedType: ApiMessageType) {
		this.receivedType = receivedType
		this.expectedType = expectedType
	}
}
