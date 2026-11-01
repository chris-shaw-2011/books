import typia from "typia"
import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class AddUserRequest extends ApiMessage {
	override readonly type = "AddUserRequest"

	static fromUnknown(json: unknown) {
		return new AddUserRequest(typia.assert<ConstructorParameters<typeof AddUserRequest>[0]>(json))
	}

	user: User

	constructor(json?: Partial<AddUserRequest> | Partial<typia.Primitive<AddUserRequest>>) {
		const data = json ?? {}

		super()

		this.user = new User(data.user)
	}
}
