/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Bodies may be absent at runtime. */
import type { ServerResponse } from "node:http"
import type { FastifyInstance } from "fastify"
import { AudibleImportResponse, type AudibleStartRequest, type AudibleRedirectRequest, type AudibleSessionRequest, type AudibleReviewRequest, type AudibleSelectionRequest } from "@books/shared"
import { validateRequest, validateRequestPreHandler } from "../Validation.ts"
import { audibleSelectionSchema } from "../SeriesSchemas.ts"
import type { AudibleImportService } from "./ImportService.ts"

interface AudibleStart { Body: AudibleStartRequest }
interface AudibleRedirect { Body: AudibleRedirectRequest }
interface AudibleCancel { Body: AudibleSessionRequest }
interface AudibleReview { Body: AudibleReviewRequest }
interface AudibleSelection { Body: AudibleSelectionRequest }

export function registerAudibleRoutes(server: FastifyInstance, importer: AudibleImportService) {
	const streams = new Set<ServerResponse>()

	server.post<AudibleStart>("/audible/start", validateRequestPreHandler, async (request, reply) => {
		reply.header("Cache-Control", "no-store")

		try {
			return new AudibleImportResponse({ snapshot: await importer.start(request.userToken?.user.id ?? "", request.body?.account, request.body?.marketplace) })
		}
		catch (error) {
			return reply.code(400).send(new AudibleImportResponse({ errorMessage: error instanceof Error ? error.message : "Unable to start import" }))
		}
	})

	server.post<AudibleRedirect>("/audible/redirect", validateRequestPreHandler, async (request, reply) => {
		const ret = new AudibleImportResponse()
		let code = 200

		reply.header("Cache-Control", "no-store")

		try {
			ret.snapshot = importer.redirect(request.userToken?.user.id ?? "", request.body?.sessionId, request.body?.redirectUrl)
		}
		catch (error) {
			code = 400

			ret.errorMessage = error instanceof Error ? error.message : "Unable to authenticate"
		}

		return reply.code(code).send(ret)
	})

	server.post<AudibleSelection>("/audible/select", { preValidation: validateRequest, schema: audibleSelectionSchema, attachValidation: true }, (request, reply) => {
		reply.header("Cache-Control", "no-store")
		if (request.validationError) return reply.code(400).send(new AudibleImportResponse({ errorMessage: request.validationError.message }))
		try {
			if (Object.keys(request.body.organizations ?? {}).length && !request.userToken?.user.isAdmin) return reply.code(403).send(new AudibleImportResponse({ errorMessage: "Only administrators can organize series in the library" }))
			return new AudibleImportResponse({ snapshot: importer.select(request.userToken?.user.id ?? "", request.body?.sessionId, request.body?.asins, request.body?.organizations) })
		}
		catch (error) {
			return reply.code(400).send(new AudibleImportResponse({ errorMessage: error instanceof Error ? error.message : "Unable to select books" }))
		}
	})

	server.get("/audible/status", validateRequestPreHandler, (request, reply) => {
		reply.header("Cache-Control", "no-store")
		return new AudibleImportResponse({ snapshot: importer.snapshot(request.userToken?.user.id ?? "") })
	})

	server.get("/audible/events", validateRequestPreHandler, (request, reply) => {
		reply.hijack()

		streams.add(reply.raw)

		reply.raw.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			"Connection": "keep-alive",
			"X-Accel-Buffering": "no",
		})

		const unsubscribe = importer.subscribe(request.userToken?.user.id ?? "", snapshot => {
			if (!reply.raw.destroyed) {
				reply.raw.write(`data: ${JSON.stringify(snapshot)}\n\n`)
			}
		})
		const heartbeat = setInterval(() => {
			if (!reply.raw.destroyed) {
				reply.raw.write(": heartbeat\n\n")
			}
		}, 20000)

		heartbeat.unref()

		reply.raw.on("close", () => {
			clearInterval(heartbeat)
			streams.delete(reply.raw)
			unsubscribe()
		})
	})

	server.post<AudibleCancel>("/audible/cancel", validateRequestPreHandler, async (request, reply) => {
		try {
			return new AudibleImportResponse({ snapshot: await importer.cancel(request.userToken?.user.id ?? "", request.body?.sessionId) })
		}
		catch {
			return reply.code(404).send(new AudibleImportResponse({ errorMessage: "Import session not found" }))
		}
	})

	server.post<AudibleReview>("/audible/review", validateRequestPreHandler, async (request, reply) => {
		try {
			return new AudibleImportResponse({ snapshot: importer.review(request.userToken?.user.id ?? "", request.body?.sessionId, request.body?.asin) })
		}
		catch {
			return reply.code(404).send(new AudibleImportResponse({ errorMessage: "Import session not found" }))
		}
	})

	server.addHook("preClose", async () => {
		for (const stream of streams) {
			stream.end()
		}
		await importer.shutdown()
	})
}
