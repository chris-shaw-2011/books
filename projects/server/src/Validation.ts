import type { FastifyReply, FastifyRequest } from "fastify"
import * as shared from "@books/shared"
import AuthorizationExpiration, { getNewAuthorizationExpiration } from "./AuthorizationExpiration.ts"

export function validateRequest(request: FastifyRequest, reply: FastifyReply, done: () => void) {
	const token = request.userToken

	if (token === undefined) {
		reply.code(401).send(new shared.Unauthorized("Please Log In"))

		done()
		return
	}

	const expiration = AuthorizationExpiration.get(token.authorization)

	if (expiration === undefined || expiration < Date.now()) {
		if (expiration !== undefined) {
			// Remove the token from memory since it expired
			AuthorizationExpiration.delete(token.authorization)
		}

		reply.code(401).send(new shared.Unauthorized("Session Expired, Please Log In Again"))

		done()
		return
	}

	AuthorizationExpiration.set(token.authorization, getNewAuthorizationExpiration())

	done()
}
