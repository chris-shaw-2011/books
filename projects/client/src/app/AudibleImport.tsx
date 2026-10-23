import { use, useEffect, useState } from "react"
import { AudibleImportResponse, type AudibleImportSnapshot } from "@books/shared"
import { Line } from "rc-progress"
import OverlayComponent from "./components/OverlayComponent"
import ModalDialog, { ModalBody, ModalFooter, ModalHeader, ModalTitle } from "./components/ModalDialog"
import Button from "./components/Button"
import CancelButton from "./components/CancelButton"
import TextboxField from "./components/TextboxField"
import Alert from "./components/Alert"
import CompletedBook from "./CompletedBook"
import LoggedInApi from "./api/LoggedInApi"
import AppContext from "./context/AppContext"
import FetchAborted from "./api/FetchAborted"
import androidRedirectExample from "../assets/audible-redirect-android.webp"
import iosRedirectExample from "../assets/audible-redirect-ios.webp"
import styles from "./AudibleImport.module.scss"

type AudibleImportState = Omit<AudibleImportResponse, "type">

const mergeAudibleImportState = (previous: AudibleImportState | undefined, next: AudibleImportState | string) => {
	const nextToMerge = typeof next === "string" ? { errorMessage: next } : next
	const ret = { ...previous, ...nextToMerge }

	if (!nextToMerge.errorMessage) {
		delete ret.errorMessage
	}

	return ret
}

const mergeProgress = (previous: AudibleImportSnapshot | undefined, next: AudibleImportSnapshot) => new AudibleImportResponse({
	snapshot:
	{
		...next,
		...(next.phase === "authenticating" && previous?.id === next.id && previous.loginUrl && { loginUrl: previous.loginUrl }),
	},
})

interface ProgressCallbacks {
	connection: (connected: boolean) => void,
	stateUpdated: (value: React.SetStateAction<AudibleImportState | undefined>) => void,
}

const connectAudibleEvents = (events: EventSource, callbacks: ProgressCallbacks) => {
	events.onopen = () => {
		callbacks.connection(true)
	}
	events.onerror = () => callbacks.connection(false)
	events.onmessage = event => {
		try {
			callbacks.stateUpdated(prev => mergeProgress(prev?.snapshot, AudibleImportResponse.restoreSnapshot(JSON.parse(event.data as string) as AudibleImportSnapshot)))
		}
		catch {
			callbacks.stateUpdated(prev => ({ ...prev, ...{ errorMessage: "Unable to read progress." } }))
		}
	}

	return () => events.close()
}

const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>(resolve => {
	if (signal.aborted) {
		resolve()
		return
	}

	AbortSignal.any([signal, AbortSignal.timeout(milliseconds)]).addEventListener("abort", () => resolve(), { once: true })
})

const openAmazonLogin = (event: React.MouseEvent<HTMLAnchorElement>, loginUrl: string) => {
	event.preventDefault()
	const loginWindow = window.open("about:blank", "_blank")

	if (!loginWindow) {
		window.alert("Your browser blocked the Amazon sign-in window. Allow pop-ups for this site, then select Sign in with Amazon again.")
		return
	}

	loginWindow.opener = null
	loginWindow.location.href = loginUrl
	window.alert("Amazon sign-in opened in a new tab. After signing in, the page may say it cannot be found. That is expected. Select the browser address bar, copy the entire address shown there, then return to Books and paste it below. Do not copy text from the page itself.")
}

const AudibleImport = ({ onClose }: { onClose: () => void }) => {
	const { logOut } = use(AppContext)
	const [snapshotState, setSnapshotState] = useState<AudibleImportState>()
	const [account, setAccount] = useState("")
	const [marketplace, setMarketplace] = useState("us")
	const [redirectUrl, setRedirectUrl] = useState("")
	const [busy, setBusy] = useState(false)
	const [connected, setConnected] = useState(false)

	useEffect(() => {
		const events = new EventSource("/audible/events")
		const controller = new AbortController()
		const disconnect = connectAudibleEvents(events, {
			connection: setConnected,
			stateUpdated: setSnapshotState,
		})
		const refreshStatus = async (signal: AbortSignal) => {
			let response: AudibleImportState | FetchAborted

			try {
				response = await LoggedInApi.audibleStatus(logOut, signal)
			}
			catch (e) {
				response = new AudibleImportResponse({ errorMessage: e instanceof Error ? e.message : "Unable to load import status." })
			}

			if (response instanceof FetchAborted || signal.aborted) {
				return
			}

			setSnapshotState(prev => ({ ...prev, ...response }))
			await wait(5000, signal)

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (!signal.aborted) {
				void refreshStatus(signal)
			}
		}
		void refreshStatus(controller.signal)

		return () => {
			disconnect()
			// The same signal cancels requests and ignores responses after cleanup.
			controller.abort()
		}
	}, [logOut])

	const request = async (action: () => Promise<AudibleImportResponse>, clearRedirect = false) => {
		setBusy(true)

		try {
			const response = await action()
			setSnapshotState(prev => mergeAudibleImportState(prev, response))

			if (!response.errorMessage && clearRedirect) {
				setRedirectUrl("")
			}
		}
		catch (e) {
			const errorMessage = e instanceof Error ? e.message : "Audible request failed."

			setSnapshotState(prev => mergeAudibleImportState(prev, errorMessage))
		}
		finally {
			setBusy(false)
		}
	}
	const { snapshot, errorMessage } = snapshotState ?? {}
	const loginUrl = snapshot?.loginUrl
	const nextBook = snapshot?.reviewQueue[0]
	const active = snapshot?.phase && ["authenticating", "scanning", "downloading"].includes(snapshot.phase)

	return (
		<OverlayComponent onClick={onClose}>
			<ModalDialog className={styles.dialog}>
				<ModalHeader><ModalTitle>Import Audible Books</ModalTitle></ModalHeader>
				<ModalBody>
					{errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
					{snapshotState === undefined && <p>Loading import status...</p>}
					{snapshotState !== undefined && !active && !nextBook && (
						<form onSubmit={e => {
							e.preventDefault()
							void request(() => LoggedInApi.audibleStart(account, marketplace, logOut))
						}}
						>
							<TextboxField label="Audible account email" value={account} onChange={e => setAccount(e.target.value)} required={true} autoComplete="username" />
							<label>
								Marketplace
								<select value={marketplace} onChange={e => setMarketplace(e.target.value)}>
									{["us", "uk", "ca", "au", "de", "fr", "it", "es", "in", "jp", "br"].map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}
								</select>
							</label>
							<p>Sign in for this import. Temporary Amazon authentication is removed when the import ends.</p>
							<Button type="submit" disabled={busy}>Start import</Button>
						</form>
					)}
					{snapshot?.phase === "authenticating" && (
						<div>
							{loginUrl && (
								<>
									<p>Your browser may block the sign-in window. If it does, allow pop-ups for this site and try again.</p>
									<a href={loginUrl} target="_blank" rel="noopener noreferrer" onClick={event => openAmazonLogin(event, loginUrl)}>Sign in with Amazon</a>
									<p>After signing in, Amazon or Audible may show a page-not-found message. This is expected. Select the browser address bar, copy the entire address, return to this window, and paste it below.</p>
									<div className={styles.examples}>
										<figure>
											<img src={iosRedirectExample} alt="iPhone Safari with the complete Audible address selected and the Copy action highlighted" />
											<figcaption>iPhone or iPad: tap the address bar, select the whole address, then tap Copy.</figcaption>
										</figure>
										<figure>
											<img src={androidRedirectExample} alt="Android Chrome with the complete Audible address selected and the Copy action highlighted" />
											<figcaption>Android: tap the address bar, select the whole address, then tap Copy.</figcaption>
										</figure>
									</div>
								</>
							)}
							{!loginUrl && <p>Preparing Amazon sign in...</p>}
							<form onSubmit={e => {
								e.preventDefault()
								void request(() => LoggedInApi.audibleRedirect(snapshot.id, redirectUrl, logOut), true)
							}}
							>
								<TextboxField label="Complete address-bar URL" type="url" value={redirectUrl} onChange={e => setRedirectUrl(e.target.value)} required={true} autoComplete="off" />
								<Button type="submit" disabled={busy || !snapshot.loginUrl}>Continue import</Button>
							</form>
						</div>
					)}
					{snapshot && (
						<div aria-live="polite">
							<h5>{snapshot.operation}</h5>
							<p>{snapshot.currentTitle}</p>
							{snapshot.percentage !== undefined && (
								<>
									<Line percent={snapshot.percentage} strokeWidth={1} strokeColor="#0000FF" />
									<p>
										{Math.round(snapshot.percentage)}
										%
									</p>
								</>
							)}
							<p>
								Discovered:
								{snapshot.total}
								{" "}
								· Skipped:
								{snapshot.skipped}
								{" "}
								· Downloaded:
								{snapshot.downloaded}
								{" "}
								· Failed:
								{snapshot.failed}
								{" "}
								· Remaining:
								{snapshot.remaining}
							</p>
							<p>
								Awaiting review:
								{snapshot.reviewQueue.length}
							</p>
							{active && !connected && <p>Reconnecting to progress... The import continues in the background.</p>}
							{snapshot.error && <Alert variant="danger">{snapshot.error}</Alert>}
							<pre className={styles.activity} aria-label="Import activity">{snapshot.activity.join("\n")}</pre>
						</div>
					)}
					{nextBook && (
						<div className={styles.review} aria-busy={busy}>
							<CompletedBook
								key={nextBook.asin}
								book={nextBook}
								onComplete={() => {
									if (!busy) {
										void request(() => LoggedInApi.audibleReview(snapshot.id, nextBook.asin, logOut))
									}
								}}
							/>
						</div>
					)}
				</ModalBody>
				<ModalFooter>
					{active && <Button disabled={busy} onClick={() => { void request(() => LoggedInApi.audibleCancel(snapshot.id, logOut)) }}>Cancel import</Button>}
					<CancelButton onClick={onClose} value="Close" />
				</ModalFooter>
			</ModalDialog>
		</OverlayComponent>
	)
}

export default AudibleImport
