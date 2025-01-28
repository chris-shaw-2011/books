import type { FastifyReply, FastifyRequest } from "fastify"
import * as shared from "@books/shared"
import AuthorizationExpiration from "./AuthorizationExpiration.js"
import dayjs from "dayjs"

const getNewExpiration = () => dayjs().add(24, "hours")

export function validateRequest(request: FastifyRequest, reply: FastifyReply, done: () => void) {
	// eslint-disable-next-line no-console
	console.log("prehandle")
	const token = request.userToken

	if (token === undefined) {
		reply.code(401).send(new shared.Unauthorized("Please Log In"))

		done()
		return
	}

	const expiration = AuthorizationExpiration.get(token.authorization)

	if (expiration === undefined || expiration < dayjs()) {
		if (expiration !== undefined) {
			//Remove the token from memory since it expired
			AuthorizationExpiration.delete(token.authorization)
		}

		reply.code(401).send(new shared.Unauthorized("Session Expired, Please Log In Again"))

		done()
		return
	}

	AuthorizationExpiration.set(token.authorization, getNewExpiration())

	done()
}
