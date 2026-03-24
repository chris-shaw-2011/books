import type { ApiMessage, ApiMessageType } from "@books/shared"

export default class UnexpectedApiMessageType {
	receivedApiMessage: ApiMessage
	expectedType: ApiMessageType

	get message() {
		return `Unexpected response received, expected: ${this.expectedType}, received: ${this.receivedApiMessage.type}`
	}

	constructor(receivedApiMessage: ApiMessage, expectedType: ApiMessageType) {
		this.receivedApiMessage = receivedApiMessage
		this.expectedType = expectedType
	}
}
