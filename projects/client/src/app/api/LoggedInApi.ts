import { Books, ChangeBookStatusRequest, ChangePasswordRequest, ConversionUpdateRequest, ConversionUpdateResponse, Token, type ConverterStatus, type Status } from "@books/shared"
import { ApiClass } from "./Api"

export class LoggedInApiClass extends ApiClass {
	books = async (onFailure: (message?: string) => void) => this.callApi("/books", Books, onFailure)

	changeBookStatus = async (bookId: string, status: Status, onFailure: (message?: string) => void) => await this.callApi("/changeBookStatus", Books, onFailure, new ChangeBookStatusRequest({ bookId, status }))

	conversionUpdate = async (conversionId: string, knownPercent: number, knownConverterStatus: ConverterStatus, knownWorkingFiles: string[], onFailure: (message?: string) => void, signal?: AbortSignal) =>
		this.callApi("/conversionUpdate", ConversionUpdateResponse, onFailure, new ConversionUpdateRequest({ conversionId, knownPercent, knownConverterStatus, knownWorkingFiles }), signal)

	changePassword = async (newPassword: string, onFailure: (message?: string) => void) => this.callApi("/changePassword", Token, onFailure, new ChangePasswordRequest({ newPassword }))
}

const LoggedInApi = new LoggedInApiClass()

export default LoggedInApi