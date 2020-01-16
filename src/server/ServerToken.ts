import bcrypt from "bcrypt"
import { ApiMessageType } from "../shared/api/ApiMessage"
import Token from "../shared/api/Token"
import User from "../shared/User"

export default class ServerToken extends Token {
   static async create(user: User, authorization: string, secret: string) {
      const token = new ServerToken({ type: ApiMessageType.Token, user, authorization, checksum: "" })

      token.checksum = await bcrypt.hash(token.valueForChecksum(secret), 10)

      return token
   }

   async isChecksumValid(secret: string) {
      return await bcrypt.compare(this.valueForChecksum(secret), this.checksum)
   }

   private valueForChecksum(secret: string) {
      return JSON.stringify(this.user) + this.authorization + secret
   }
}
