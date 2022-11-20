import bcrypt from "bcrypt"
import { ApiMessageType, Token, User } from "@books/shared"

export default class ServerToken extends Token {
	static async create(user: User, authorization: string, secret: string) {
		const token = new ServerToken({ type: ApiMessageType.Token, user, authorization, checksum: "" })

		token.checksum = await bcrypt.hash(token.valueForChecksum(secret), 10)

		return token
	}

	isChecksumValid(secret: string) {
		return bcrypt.compareSync(this.valueForChecksum(secret), this.checksum)
	}

	private valueForChecksum(secret: string) {
		return JSON.stringify(this.user) + this.authorization + secret
	}
}
