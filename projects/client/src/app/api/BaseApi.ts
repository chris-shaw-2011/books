import { AccessDenied, Unauthorized, ApiMessage } from "@books/shared"
import FetchAborted from "./FetchAborted.ts"
import UnexpectedApiMessageType from "./UnexpectedApiMessageType.ts"

interface ApiResponseClass<T extends ApiMessage> {
	new (): T,
	fromUnknown(json: unknown): T,
}

export default abstract class BaseApi {
	async fetchWithType(url: string, jsonSend?: ApiMessage, signal?: AbortSignal, method: "GET" | "POST" = "POST"): Promise<unknown> {
		const headers = jsonSend ? { "Content-Type": "application/json" } : {}
		const init: RequestInit = {
			method,
			headers: headers,
			...(method === "POST" && { body: jsonSend ? JSON.stringify(jsonSend) : "" }),
		}
		let response: Response

		if (signal) {
			init.signal = signal

			try {
				response = await fetch(url, init)
			}
			catch (e) {
				if (e instanceof Error) {
					if (e.name === "AbortError") {
						return new FetchAborted(e)
					}
				}

				throw e
			}
		}
		else {
			response = await fetch(url, init)
		}

		const json: unknown = await response.json()

		return json
	}

	public handleApiResponse<T extends ApiMessage>(response: FetchAborted, expectedResponseType: ApiResponseClass<T>, onFailure: (message?: string) => void): FetchAborted
	public handleApiResponse<T extends ApiMessage>(response: unknown, expectedResponseType: ApiResponseClass<T>, onFailure: (message?: string) => void): T
	public handleApiResponse<T extends ApiMessage>(response: unknown, expectedResponseType: ApiResponseClass<T>, onFailure: (message?: string) => void) {
		if (response instanceof FetchAborted) {
			return response
		}

		const result = this.resultType(response, expectedResponseType)

		if (result instanceof Unauthorized || result instanceof AccessDenied) {
			onFailure(result.message)

			return
		}
		else if (!(result instanceof expectedResponseType)) {
			let msg = `Unexpected response received`

			if (result instanceof UnexpectedApiMessageType) {
				msg += `, expected: ${result.expectedType}, received: ${result.receivedType}`
			}

			// eslint-disable-next-line no-console
			console.error(msg, response)
			onFailure(msg)

			return
		}

		return result
	}

	protected async callApi<T extends ApiMessage>(url: string, expectedResponseType: ApiResponseClass<T>, onFailure: (message?: string) => void, jsonSend?: ApiMessage): Promise<T>
	protected async callApi<T extends ApiMessage>(url: string, expectedResponseType: ApiResponseClass<T>, onFailure: (message?: string) => void, jsonSend?: ApiMessage, signal?: AbortSignal, method?: "GET" | "POST"): Promise<T | FetchAborted>
	protected async callApi<T extends ApiMessage>(url: string, expectedResponseType: ApiResponseClass<T>, onFailure: (message?: string) => void, jsonSend?: ApiMessage, signal?: AbortSignal, method: "GET" | "POST" = "POST") {
		const response = await this.fetchWithType(url, jsonSend, signal, method)

		return this.handleApiResponse(response, expectedResponseType, onFailure)
	}

	private resultType<T extends ApiMessage>(json: unknown, expectedResponseType: ApiResponseClass<T>) {
		const receivedType = typeof json === "object" && json !== null && "type" in json ? json.type : undefined

		if (receivedType === "AccessDenied") {
			return AccessDenied.fromUnknown(json)
		}
		else if (receivedType === "Unauthorized") {
			return Unauthorized.fromUnknown(json)
		}
		else {
			const typeChecker = new expectedResponseType()

			if (typeof receivedType === "string" && typeChecker.type !== receivedType) {
				return new UnexpectedApiMessageType(receivedType, typeChecker.type)
			}

			return expectedResponseType.fromUnknown(json)
		}
	}
}
