import User from "../User.js"
import ApiMessage from "./ApiMessage.js"

export default class Token extends ApiMessage {
	override readonly type = "Token"

	user: User
	authorization: string
	checksum: string

	constructor(json?: Partial<Token>) {
		super()

		this.user = new User(json?.user)
		this.authorization = json?.authorization ?? ""
		this.checksum = json?.checksum ?? ""
	}

	isValid() {
		return this.authorization !== "" && this.checksum !== "" && this.user.isValid()
	}

	static fromJSON(json?: string) {
		if (json) {
			const token = new Token(JSON.parse(json) as Partial<Token>)

			if (token.isValid()) {
				return token
			}
		}

		// eslint-disable-next-line no-console
		console.error("Specified JSON isn't a valid Token", json)

		return undefined
	}
}
