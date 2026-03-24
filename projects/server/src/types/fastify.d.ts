// types/fastify.d.ts
import "fastify"
import ServerToken from "../ServerToken.ts"

declare module "fastify" {
	interface FastifyRequest {
		userToken?: ServerToken,
	}
}
