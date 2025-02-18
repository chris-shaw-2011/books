import bcrypt from "bcrypt"
import { Token, User } from "@books/shared"

export default class ServerToken extends Token {
	secret: string

	constructor(json: Partial<Token>, secret: string) {
		super(json)

		this.secret = secret
	}

	static async create(user: User, authorization: string, secret: string) {
		const token = new ServerToken({ user, authorization }, secret)

		token.checksum = await bcrypt.hash(token.valueForChecksum(), 10)

		return token
	}

	override isValid() {
		return super.isValid() && bcrypt.compareSync(this.valueForChecksum(), this.checksum)
	}

	private valueForChecksum() {
		return JSON.stringify(this.user) + this.authorization + this.secret
	}

	// TODO: probably don't need this method and should use constructor instead
	static override fromJSON(secret: string, json?: string) {
		const token = super.fromJSON(json)

		if (token !== undefined) {
			const serverToken = new ServerToken(token, secret)

			if (serverToken.isValid()) {
				return serverToken
			}
			else {
				// eslint-disable-next-line no-console
				console.error("Specified JSON isn't a valid ServerToken", json)
			}
		}

		return undefined
	}
}