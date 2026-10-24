// Libation redraws [###...] bars using backspaces, and may split frames across PTY chunks.
export default class DownloadProgress {
	private buffer = ""
	private percentage?: number

	update(data: string) {
		this.buffer = (this.buffer + data).slice(-32000)
		// Keep incomplete escape sequences buffered until the next chunk arrives.
		// eslint-disable-next-line no-control-regex
		const output = this.buffer.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
		const frame = [...output.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%|\[([#.]{2,})\]/g)].at(-1)
		if (!frame) return
		const bar = frame[2]
		const percentage = bar ? 100 * (bar.match(/#/g)?.length ?? 0) / bar.length : Math.min(100, Number(frame[1]?.replace(",", ".")))
		if (percentage === this.percentage) return
		this.percentage = percentage
		return percentage
	}
}
