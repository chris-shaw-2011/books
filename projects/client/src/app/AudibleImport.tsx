import { use, useEffect, useRef, useState } from "react"
import classnames from "classnames"
import { AudibleImportResponse, type AudibleImportSnapshot } from "@books/shared"
import OverlayComponent from "./components/OverlayComponent"
import ModalDialog, { ModalBody, ModalFooter, ModalHeader, ModalTitle } from "./components/ModalDialog"
import Button from "./components/Button"
import CancelButton from "./components/CancelButton"
import TextboxField from "./components/TextboxField"
import Alert from "./components/Alert"
import AudibleBookList from "./AudibleBookList"
import LoggedInApi from "./api/LoggedInApi"
import AppContext from "./context/AppContext"
import FetchAborted from "./api/FetchAborted"
import androidRedirectExample from "../assets/audible-redirect-android.webp"
import iosRedirectExample from "../assets/audible-redirect-ios.webp"
import styles from "./AudibleImport.module.scss"

type AudibleImportState = Omit<AudibleImportResponse, "type">

const mergeAudibleImportState = (previous: AudibleImportState | undefined, next: AudibleImportState | string) => {
	const nextToMerge: AudibleImportState = typeof next === "string" ? { errorMessage: next } : next
	const ret = { ...previous, ...nextToMerge, snapshot: nextToMerge.snapshot ?? previous?.snapshot }

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

const ImportStep = ({ number, title, children }: { number: number, title: string, children: React.ReactNode }) => {
	const headingRef = useRef<HTMLHeadingElement>(null)

	useEffect(() => headingRef.current?.focus(), [number])

	return (
		<section className={styles.step}>
			<p className={styles.eyebrow}>{`Step ${number} of 4`}</p>
			<h2 ref={headingRef} tabIndex={-1}>{title}</h2>
			{children}
		</section>
	)
}

const AudibleSignIn = ({ loginUrl, busy, onSubmit }: { loginUrl: string, busy: boolean, onSubmit: (address: string) => void }) => {
	const [step, setStep] = useState(2)
	const [device, setDevice] = useState(() => /Android/i.test(navigator.userAgent) ? "android" : "ios")
	const [address, setAddress] = useState("")
	const [blocked, setBlocked] = useState(false)
	const openLogin = (event: React.MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault()
		const loginWindow = window.open("about:blank", "_blank")

		if (!loginWindow) {
			setBlocked(true)
			return
		}

		loginWindow.opener = null
		loginWindow.location.href = loginUrl
		setBlocked(false)
		setStep(3)
	}

	return (
		<ImportStep number={step} title={step === 2 ? "Sign in with Amazon" : step === 3 ? "Copy the address after signing in" : "Paste the address here"}>
			{step === 2 && (
				<>
					<p>Sign in using the Amazon account you use for Audible. A new browser tab will open.</p>
					<div className={styles.note}>
						<strong>Before you go</strong>
						<p>After signing in, you may see “Looking for something?” or “Page not found.” This is expected. Leave that tab open and come back here for the next step.</p>
					</div>
					{blocked && <Alert variant="danger">The sign-in tab could not open. Allow pop-ups for this site in your browser settings, then try again.</Alert>}
					<a className={styles.primary} href={loginUrl} target="_blank" rel="noopener noreferrer" onClick={openLogin}>
						Open Amazon sign-in
						<span aria-hidden="true">↗</span>
					</a>
					<Button className={styles.textButton} onClick={() => setStep(3)}>Already signed in? Go to the next step</Button>
				</>
			)}
			{step === 3 && (
				<>
					<div className={styles.note}>
						<strong>A “page not found” message is OK</strong>
						<p>You still need the address at the top or bottom of that tab. Keep the page open.</p>
					</div>
					<ol className={styles.instructions}>
						<li>Switch to the Amazon or Audible tab where you just signed in.</li>
						<li>
							Tap the browser’s address bar. Touch and hold the address, then choose
							{" "}
							<strong>Select All</strong>
							{" "}
							if needed and
							{" "}
							<strong>Copy</strong>
							.
						</li>
						<li>Switch back to this Books tab.</li>
					</ol>
					<details className={styles.help}>
						<summary>Show me where to tap</summary>
						<div className={styles.devicePicker} role="group" aria-label="Choose your phone">
							<Button aria-pressed={device === "ios"} onClick={() => setDevice("ios")}>iPhone / iPad</Button>
							<Button aria-pressed={device === "android"} onClick={() => setDevice("android")}>Android</Button>
						</div>
						<figure className={styles.example}>
							<img src={device === "ios" ? iosRedirectExample : androidRedirectExample} alt={device === "ios" ? "iPhone example: the address bar is at the bottom. The full address and Copy button are outlined in red." : "Android example: the address bar is at the top. The full address and Copy button are outlined in yellow."} />
							<figcaption>
								{device === "ios" ? "On this iPhone, the address bar is at the bottom. Yours may be at the top." : "On Android, look for the address bar at the top."}
								{" "}
								Copy the whole address, even if only part of it is visible.
							</figcaption>
						</figure>
					</details>
					<Button className={styles.primary} onClick={() => setStep(4)}>I’ve copied the address</Button>
					<Button className={styles.textButton} onClick={() => setStep(2)}>Back to Amazon sign-in</Button>
				</>
			)}
			{step === 4 && (
				<form onSubmit={event => {
					event.preventDefault()
					onSubmit(address.trim())
				}}
				>
					<p>
						Touch and hold the box below, then tap
						{" "}
						<strong>Paste</strong>
						.
					</p>
					<TextboxField label="Address you copied" type="url" value={address} onChange={event => setAddress(event.target.value)} required={true} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Paste the full address here" aria-describedby="audible-address-help" />
					<p id="audible-address-help" className={styles.hint}>It usually starts with https://www.audible.com/ap/maplanding or an Amazon address. It may be very long — paste all of it.</p>
					<Button className={styles.primary} type="submit" disabled={busy || !address.trim()}>{busy ? "Connecting to Audible…" : "Connect and choose books"}</Button>
					<Button className={styles.textButton} disabled={busy} onClick={() => setStep(3)}>Back to copying instructions</Button>
				</form>
			)}
		</ImportStep>
	)
}

const AudibleImport = ({ onClose }: { onClose: () => void }) => {
	const { logOut } = use(AppContext)
	const [snapshotState, setSnapshotState] = useState<AudibleImportState>()
	const [account, setAccount] = useState("")
	const [marketplace, setMarketplace] = useState("us")
	const [busy, setBusy] = useState(false)
	const [connected, setConnected] = useState(false)
	const [showSetup, setShowSetup] = useState(false)

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

			setSnapshotState(prev => mergeAudibleImportState(prev, response))
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

	const request = async (action: () => Promise<AudibleImportResponse>) => {
		setBusy(true)

		try {
			const response = await action()
			setSnapshotState(prev => mergeAudibleImportState(prev, response))

			if (response.snapshot?.phase === "authenticating") {
				setShowSetup(false)
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
	const hasReviews = Boolean(snapshot?.reviewQueue.length)
	const active = snapshot?.phase && ["authenticating", "scanning", "selecting", "downloading"].includes(snapshot.phase)

	return (
		<OverlayComponent className={classnames(styles.overlay, { [styles.expanded]: snapshot && snapshot.phase !== "authenticating" && !showSetup })} onClick={onClose}>
			<ModalDialog className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="audible-import-title">
				<ModalHeader><ModalTitle id="audible-import-title">Add your Audible books</ModalTitle></ModalHeader>
				<ModalBody>
					{errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
					{snapshotState === undefined && <p>Loading import status...</p>}
					{snapshotState !== undefined && (!snapshot || showSetup) && !active && !hasReviews && (
						<ImportStep number={1} title="Let’s find your Audible account">
							<p>Sign in to Amazon, then choose which Audible books to bring into Books.</p>
							<form onSubmit={e => {
								e.preventDefault()
								void request(() => LoggedInApi.audibleStart(account, marketplace, logOut))
							}}
							>
								<TextboxField label="Email you use for Audible" type="email" placeholder="you@example.com" autoCapitalize="none" spellCheck={false} value={account} onChange={e => setAccount(e.target.value)} required={true} autoComplete="username" />
								<label>
									Audible country
									<select value={marketplace} onChange={e => setMarketplace(e.target.value)}>
										{Object.entries({ us: "United States (audible.com)", uk: "United Kingdom (audible.co.uk)", ca: "Canada (audible.ca)", au: "Australia (audible.com.au)", de: "Germany (audible.de)", fr: "France (audible.fr)", it: "Italy (audible.it)", es: "Spain (audible.es)", in: "India (audible.in)", jp: "Japan (audible.co.jp)", br: "Brazil (audible.com.br)" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
									</select>
								</label>
								<p className={styles.hint}>Choose the country where you buy your Audible books. Next, we’ll give you a link to sign in with Amazon.</p>
								<Button className={styles.primary} type="submit" disabled={busy}>{busy ? "Preparing sign-in…" : "Continue to sign-in"}</Button>
							</form>
						</ImportStep>
					)}
					{snapshot?.phase === "authenticating" && (
						loginUrl ?
								<AudibleSignIn key={snapshot.id} loginUrl={loginUrl} busy={busy} onSubmit={address => { void request(() => LoggedInApi.audibleRedirect(snapshot.id, address, logOut)) }} /> :
								<p role="status">Preparing your Amazon sign-in link…</p>
					)}
					{snapshot && snapshot.phase !== "authenticating" && !showSetup && (
						<section className={styles.progress} aria-live="polite">
							<h2>{({ scanning: "Finding your Audible books…", selecting: "Choose books to import", downloading: "Adding your books…", complete: "Your import is finished", cancelled: "Import stopped", failed: "Your import couldn’t finish" })[snapshot.phase]}</h2>
							{snapshot.phase === "scanning" && <p>Finding titles and covers. No books are downloading yet.</p>}
							{snapshot.phase === "downloading" && <p>You can close this window. Your selected books will keep importing.</p>}
							<p>
								{snapshot.downloaded}
								{" "}
								added ·
								{" "}
								{snapshot.skipped}
								{" "}
								already in Books
								{snapshot.remaining > 0 && ` · ${snapshot.remaining} remaining`}
							</p>
							{snapshot.failed > 0 && (
								<p>
									{snapshot.failed}
									{" "}
									{snapshot.failed === 1 ? "book couldn’t" : "books couldn’t"}
									{" "}
									be added. You can try importing again.
								</p>
							)}
							{hasReviews && (
								<p>
									{snapshot.reviewQueue.length}
									{" "}
									{snapshot.reviewQueue.length === 1 ? "book is" : "books are"}
									{" "}
									ready to review in the list below.
								</p>
							)}
							{active && !connected && <p>Updating import status…</p>}
							{snapshot.error && <Alert variant="danger">{snapshot.error}</Alert>}
							<details className={styles.help}>
								<summary>Import details</summary>
								<p>
									{snapshot.total}
									{" "}
									books found ·
									{" "}
									{snapshot.operation}
								</p>
								<pre className={styles.activity} aria-label="Import activity">{snapshot.activity.join("\n")}</pre>
							</details>
						</section>
					)}
					{snapshot && (snapshot.books.length > 0 || snapshot.phase === "selecting") && !showSetup && (
						<AudibleBookList
							key={snapshot.id}
							snapshot={snapshot}
							busy={busy}
							onSelect={(asins, organizations) => { void request(() => LoggedInApi.audibleSelect(snapshot.id, asins, logOut, organizations)) }}
							onReview={asin => {
								void request(() => LoggedInApi.audibleReview(snapshot.id, asin, logOut))
							}}
						/>
					)}
					{snapshot && !active && !hasReviews && !showSetup && <Button className={styles.primary} onClick={() => setShowSetup(true)}>Import more books or try again</Button>}
				</ModalBody>
				<ModalFooter className={styles.footer}>
					{active && <Button className={styles.textButton} disabled={busy} onClick={() => { void request(() => LoggedInApi.audibleCancel(snapshot.id, logOut)) }}>Stop import</Button>}
					<CancelButton onClick={onClose} value="Close" />
				</ModalFooter>
			</ModalDialog>
		</OverlayComponent>
	)
}

export default AudibleImport
