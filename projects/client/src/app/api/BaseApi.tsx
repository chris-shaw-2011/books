import { AccessDenied, Unauthorized, ApiMessage } from "@books/shared"

export default abstract class BaseApi {
	fetchWithType = async <T extends ApiMessage>(url: string, ctor: new (args: Partial<T>) => T, jsonSend?: ApiMessage): Promise<T | AccessDenied | Unauthorized> => {
		const headers = jsonSend ? { "Content-Type": "application/json" } : {}
		const result = await fetch(url, {
			method: "POST",
			headers: headers,
			body: jsonSend ? JSON.stringify(jsonSend) : "",
		})
		const jsonRet = await result.json() as ApiMessage

		if (jsonRet.type === "AccessDenied") {
			return new AccessDenied(jsonRet as AccessDenied)
		}
		else if (jsonRet.type === "Unauthorized") {
			return new Unauthorized(jsonRet as Unauthorized)
		}
		else {
			const typeChecker = new ctor({})

			if (typeChecker.type !== jsonRet.type) {
				throw Error(`Response contained ApiMessageType: ${jsonRet.type} but expected ApiMessageType: ${typeChecker.type}`)
			}

			return new ctor(jsonRet as T)
		}
	}
}