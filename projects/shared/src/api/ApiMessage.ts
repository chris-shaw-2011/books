import ApiMessageType from "./ApiMessageType"

export default class ApiMessage {
	type: ApiMessageType

	constructor(type: ApiMessageType) {
		this.type = type
	}
}
