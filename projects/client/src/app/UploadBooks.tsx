import { Line } from "rc-progress"
import { useContext, useEffect, useState, useCallback, useEffectEvent } from "react"
import { ListGroup, Modal } from "react-bootstrap"
import { v4 as uuid } from "uuid"
import { UploadResponse, type ConverterStatus, ConverterStatuses, Book, ApiMessage, AllowedUploadFileExtensions, canBeUploaded } from "@books/shared"
import Api from "./api/LoggedInApi"
import AppContext from "./context/AppContext"
import OverlayComponent from "./components/OverlayComponent"
import CancelButton from "./components/CancelButton"
import styles from "./UploadBooks.module.scss"
import BookLink from "./BookLink"
import classnames from "classnames"
import ModalDialog from "./components/ModalDialog"
import FetchAborted from "./api/FetchAborted"

// TODO: make it so if you close the modal you can re open it and see where it's at
// TODO: this needs refactored, it seems like there's too much going on in this component
type UploadStatus = ConverterStatus | "Uploading" | "Editing" | "Done"

interface Props {
	onClose: () => void,
}

interface FileUploadRowProps {
	onStatusChanged: (id: string, status: UploadStatus) => void,
	id: string,
}

interface FileUploadRowState {
	status: UploadStatus,
	percent: number,
	conversionId: string,
	errorMessage: string,
	uploadFileName: string,
	workingFileNames: string[],
}

const ToConverterStatus = (status: UploadStatus): ConverterStatus => {
	if ((ConverterStatuses as readonly string[]).includes(status)) {
		return status as ConverterStatus
	}
	else {
		return "Waiting"
	}
}

const IsConversionRunning = (status: UploadStatus) => (status === "Extracting" || status === "Cracking" || status === "Converting" || status === "Combining")

const ProgressSection = ({ status, percent, uploadFileName, errorMessage, workingFileNames }: FileUploadRowState) => {
	const percentTxt = `${Math.round(percent)}%`
	const text = [percentTxt, status]

	if (workingFileNames.length === 1 && workingFileNames[0]) {
		text.push(workingFileNames[0])
	}

	return (
		<div>
			<div>{uploadFileName}</div>
			<div>
				<Line percent={percent} strokeWidth={1} strokeColor={status === "Error" ? "#FF0000" : IsConversionRunning(status) ? "#0000FF" : "#00FF00"} />
			</div>
			<div>{text.join(" ")}</div>
			{status === "Error" && (
				<div className={styles.error}>
					<div>
						{errorMessage}
					</div>
				</div>
			)}
		</div>
	)
}

const FileUploadRow = (props: FileUploadRowProps) => {
	const [uploadState, setUploadState] = useState<FileUploadRowState>({
		status: "Waiting",
		percent: 0,
		conversionId: "",
		errorMessage: "",
		uploadFileName: "",
		workingFileNames: [],
	})
	const status = uploadState.status
	const percent = uploadState.percent
	const conversionId = uploadState.conversionId
	const { logOut } = useContext(AppContext)
	const [editingBook, setEditingBook] = useState<Book>()
	const onStatusChanged = props.onStatusChanged
	const id = props.id
	const workingFileNames = uploadState.workingFileNames
	const uploadFile = (files: FileList | null) => {
		const file = files?.[0]

		if (!file || !canBeUploaded(file.name)) {
			return
		}

		const request = new XMLHttpRequest()
		const data = new FormData()

		onStatusChanged(id, "Uploading")
		setUploadState(prev => ({ ...prev, percent: 0, status: "Uploading", fileName: file.name }))

		data.append("fileName", file.name)
		data.append("file", file)

		request.open("POST", "/upload", true)
		request.upload.onprogress = e => {
			setUploadState(prev => ({ ...prev, percent: (e.loaded / e.total) * 100, status: "Uploading" }))
		}
		request.onreadystatechange = () => {
			if (request.readyState === XMLHttpRequest.DONE) {
				const ret = Api.handleApiResponse(JSON.parse(request.responseText) as ApiMessage, UploadResponse, logOut)

				onStatusChanged(id, ret.converterStatus)
				setUploadState(prev => ({ ...prev, conversionId: ret.conversionId, percent: 0, status: ret.converterStatus }))
			}
		}
		request.send(data)
	}
	const getConversionUpdate = useEffectEvent(async (controller: AbortController) => {
		const ret = await Api.conversionUpdate(conversionId, percent, ToConverterStatus(status), workingFileNames, logOut, controller.signal)

		if (ret instanceof FetchAborted) {
			return
		}

		const newStatus: UploadStatus = ret.converterStatus === "Complete" ? "Editing" : ret.converterStatus

		onStatusChanged(id, newStatus)
		setUploadState(prev => ({ ...prev, percent: ret.conversionPercent, status: newStatus, errorMessage: ret.errorMessage, workingFileNames: ret.fileNames }))

		if (newStatus === "Editing") {
			setEditingBook(ret.book)
		}
	})

	useEffect(() => {
		const controller = new AbortController()

		if (conversionId && IsConversionRunning(status)) {
			void getConversionUpdate(controller)
		}

		return () => controller.abort()
	}, [status, percent, conversionId, id, workingFileNames])

	if (status === "Waiting") {
		return (
			<div>
				<form>
					<div>
						<input type="file" required={true} placeholder="Specify File" accept={AllowedUploadFileExtensions.join(",")} onChange={e => { uploadFile(e.currentTarget.files) }} />
					</div>
				</form>
			</div>
		)
	}
	else if (editingBook) {
		return (
			<div>
				<BookLink book={editingBook} editOnly={true} onEditComplete={() => onStatusChanged(id, "Done")} />
			</div>
		)
	}
	else {
		return <ProgressSection {...uploadState} />
	}
}

const UploadBooks = (props: Props) => {
	const [fileUploadRows, setFileUploadRows] = useState<Map<string, UploadStatus>>(new Map([[uuid(), "Waiting"]]))
	const onStatusChanged = useCallback((id: string, status: UploadStatus) => {
		setFileUploadRows(prev => {
			const prevStatus = prev.get(id) ?? "Waiting"

			prev.set(id, status)

			if (prevStatus === "Waiting" && status !== "Waiting") {
				prev.set(uuid(), "Waiting")
			}
			else if (status === "Done" && prevStatus !== "Done") {
				prev.delete(id)
			}

			return new Map<string, UploadStatus>(prev)
		})
	}, [])
	const arr = Array.from(fileUploadRows.entries())

	return (
		<OverlayComponent onClick={props.onClose} className={classnames({ [styles.editingBook]: arr.some(v => v[1] === "Editing") })}>
			<ModalDialog className={styles.upload}>
				<Modal.Header>
					<Modal.Title>Upload Files</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<h5>Allowed Uploads</h5>
					<ul>
						<li>Books downloaded from audible (.aax)</li>
						<li>Zip file containing multiple mp3 or aax files of a single book</li>
						<li>A single mp3 file</li>
					</ul>
					<ListGroup>
						{arr.map(v => <ListGroup.Item key={v[0]}><FileUploadRow onStatusChanged={onStatusChanged} id={v[0]} /></ListGroup.Item>)}
					</ListGroup>
				</Modal.Body>
				<Modal.Footer>
					<CancelButton onClick={props.onClose} value="Close" />
				</Modal.Footer>
			</ModalDialog>
		</OverlayComponent>
	)
}

export default UploadBooks
