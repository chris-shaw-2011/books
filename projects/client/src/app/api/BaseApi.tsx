import { AccessDenied, Unauthorized, ApiMessage } from "@books/shared"
import FetchAborted from "./FetchAborted"
import UnexpectedApiMessageType from "./UnexpectedApiMessageType"

export default abstract class BaseApi {
	async fetchWithType(url: string, jsonSend?: ApiMessage): Promise<ApiMessage>
	async fetchWithType(url: string, jsonSend?: ApiMessage, signal?: AbortSignal): Promise<ApiMessage | FetchAborted>
	async fetchWithType(url: string, jsonSend?: ApiMessage, signal?: AbortSignal) {
		const headers = jsonSend ? { "Content-Type": "application/json" } : {}
		const init: RequestInit = {
			method: "POST",
			headers: headers,
			body: jsonSend ? JSON.stringify(jsonSend) : "",
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

		return await response.json() as ApiMessage
	}

	public handleApiResponse<T extends ApiMessage>(response: ApiMessage, expectedResponseType: new (args: Partial<T>) => T, onFailure: (message?: string) => void): T
	public handleApiResponse<T extends ApiMessage>(response: ApiMessage | FetchAborted, expectedResponseType: new (args: Partial<T>) => T, onFailure: (message?: string) => void): T | FetchAborted
	public handleApiResponse<T extends ApiMessage>(response: ApiMessage | FetchAborted, expectedResponseType: new (args: Partial<T>) => T, onFailure: (message?: string) => void) {
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
				msg += `, expected: ${result.expectedType}, received: ${result.receivedApiMessage.type}`
			}

			// eslint-disable-next-line no-console
			console.error(msg, response)
			onFailure(msg)

			return
		}

		return result
	}

	protected async callApi<T extends ApiMessage>(url: string, expectedResponseType: new (args: Partial<T>) => T, onFailure: (message?: string) => void, jsonSend?: ApiMessage): Promise<T>
	protected async callApi<T extends ApiMessage>(url: string, expectedResponseType: new (args: Partial<T>) => T, onFailure: (message?: string) => void, jsonSend?: ApiMessage, signal?: AbortSignal): Promise<T | FetchAborted>
	protected async callApi<T extends ApiMessage>(url: string, expectedResponseType: new (args: Partial<T>) => T, onFailure: (message?: string) => void, jsonSend?: ApiMessage, signal?: AbortSignal) {
		const response = await this.fetchWithType(url, jsonSend, signal)

		return this.handleApiResponse(response, expectedResponseType, onFailure)
	}

	private resultType<T extends ApiMessage>(json: ApiMessage, expectedResponseType: new (args: Partial<T>) => T) {
		if (json.type === "AccessDenied") {
			return new AccessDenied(json)
		}
		else if (json.type === "Unauthorized") {
			return new Unauthorized(json)
		}
		else {
			const typeChecker = new expectedResponseType({})
			if (typeChecker.type !== json.type) {
				return new UnexpectedApiMessageType(json, typeChecker.type)
			}

			return new expectedResponseType(json as T)
		}
	}
}