import typia from "typia"
import User from "../User.ts"
import ApiMessage from "./ApiMessage.ts"

export default class Token extends ApiMessage {
	override readonly type = "Token"

	static fromUnknown(json: unknown) {
		return new Token(typia.assert<typia.Primitive<Token>>(json))
	}

	user: User
	authorization: string
	checksum: string

	constructor(json?: Partial<Token> | Partial<typia.Primitive<Token>>) {
		const data = json ?? {}
		super()

		this.user = new User(data.user)
		this.authorization = data.authorization ?? ""
		this.checksum = data.checksum ?? ""
	}

	isValid() {
		return this.authorization !== "" && this.checksum !== "" && this.user.isValid()
	}

	static fromJSON(json?: string) {
		if (json) {
			try {
				const token = Token.fromUnknown(JSON.parse(json))
				if (token.isValid()) return token
			}
			catch (error) {
				if (!(error instanceof SyntaxError) && !(error instanceof typia.TypeGuardError)) throw error
			}
		}

		// eslint-disable-next-line no-console
		console.error("Specified JSON isn't a valid Token", json)

		return undefined
	}
}
