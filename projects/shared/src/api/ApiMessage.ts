import ApiMessageType from "./ApiMessageType.js"

export default class ApiMessage {
	type: ApiMessageType

	constructor(type: ApiMessageType) {
		this.type = type
	}
}
