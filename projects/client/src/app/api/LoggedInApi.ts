import { AudibleImportResponse, AudibleRedirectRequest, AudibleReviewRequest, AudibleSelectionRequest, AudibleSessionRequest, AudibleStartRequest, Books, ChangeBookStatusRequest, ChangePasswordRequest, ConversionUpdateRequest, ConversionUpdateResponse, Token, type ConverterStatus, type Status } from "@books/shared"
import { ApiClass } from "./Api.ts"

export class LoggedInApiClass extends ApiClass {
	books = async (onFailure: (message?: string) => void) => this.callApi("/books", Books, onFailure)

	changeBookStatus = async (bookId: string, status: Status, onFailure: (message?: string) => void) => await this.callApi("/changeBookStatus", Books, onFailure, new ChangeBookStatusRequest({ bookId, status }))

	conversionUpdate = async (conversionId: string, knownPercent: number, knownConverterStatus: ConverterStatus, knownWorkingFiles: string[], onFailure: (message?: string) => void, signal?: AbortSignal) =>
		this.callApi("/conversionUpdate", ConversionUpdateResponse, onFailure, new ConversionUpdateRequest({ conversionId, knownPercent, knownConverterStatus, knownWorkingFiles }), signal)

	changePassword = async (newPassword: string, onFailure: (message?: string) => void) => this.callApi("/changePassword", Token, onFailure, new ChangePasswordRequest({ newPassword }))

	audibleStatus = async (onFailure: (message?: string) => void, signal?: AbortSignal) =>
		this.callApi("/audible/status", AudibleImportResponse, onFailure, undefined, signal, "GET")

	audibleStart = async (account: string, marketplace: string, onFailure: (message?: string) => void) =>
		this.callApi("/audible/start", AudibleImportResponse, onFailure, new AudibleStartRequest({ account, marketplace }))

	audibleRedirect = async (sessionId: string, redirectUrl: string, onFailure: (message?: string) => void) =>
		this.callApi("/audible/redirect", AudibleImportResponse, onFailure, new AudibleRedirectRequest({ sessionId, redirectUrl }))

	audibleSelect = async (sessionId: string, asins: string[], onFailure: (message?: string) => void) =>
		this.callApi("/audible/select", AudibleImportResponse, onFailure, new AudibleSelectionRequest({ sessionId, asins }))

	audibleCancel = async (sessionId: string, onFailure: (message?: string) => void) =>
		this.callApi("/audible/cancel", AudibleImportResponse, onFailure, new AudibleSessionRequest({ sessionId }))

	audibleReview = async (sessionId: string, asin: string, onFailure: (message?: string) => void) =>
		this.callApi("/audible/review", AudibleImportResponse, onFailure, new AudibleReviewRequest({ sessionId, asin }))
}

const LoggedInApi = new LoggedInApiClass()

export default LoggedInApi
