import Token from "../shared/api/Token"
import bcrypt from "bcrypt"
import User from "../shared/User"
import { ApiMessageType } from "../shared/api/ApiMessage";

export default class ServerToken extends Token {
   static async create(user: User, authorization: string, secret: string) {
      var token = new ServerToken({ type: ApiMessageType.Token, user: user, authorization: authorization, checksum: "" })

      token.checksum = await bcrypt.hash(token.valueForChecksum(secret), 10);

      return token;
   }

   private valueForChecksum(secret: string) {
      return JSON.stringify(this.user) + this.authorization + secret
   }

   async isChecksumValid(secret: string) {
      return await bcrypt.compare(this.valueForChecksum(secret), this.checksum)
   }
}