export default class FetchAborted {
	exception: Error

	constructor(e: Error) {
		this.exception = e
	}
}
