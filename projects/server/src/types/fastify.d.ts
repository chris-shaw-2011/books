// types/fastify.d.ts
import "fastify"
import ServerToken from "../ServerToken.js" // Adjust the import to match your token type

declare module "fastify" {
	interface FastifyRequest {
		userToken?: ServerToken; // Adjust the type to match your token type
	}
}