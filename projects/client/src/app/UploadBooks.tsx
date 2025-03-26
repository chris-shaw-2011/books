import { Line } from "rc-progress"
import { useContext, useEffect, useState, useCallback } from "react"
import { ListGroup, Modal } from "react-bootstrap"
import { v4 as uuid } from "uuid"
import { AccessDenied, ConversionUpdateResponse, Unauthorized, UploadResponse, type ConverterStatus, ConverterStatuses, Book, ApiMessage } from "@books/shared"
import Api from "./api/LoggedInApi"
import AppContext from "./context/AppContext"
import OverlayComponent from "./components/OverlayComponent"
import CancelButton from "./components/CancelButton"
import styles from "./UploadBooks.module.scss"
import BookLink from "./BookLink"
import classnames from "classnames"
import ModalDialog from "./components/ModalDialog"

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
	fileName: string,
}

const ToConverterStatus = (status: UploadStatus): ConverterStatus => {
	if ((ConverterStatuses as readonly string[]).includes(status)) {
		return status as ConverterStatus
	}
	else {
		return "Waiting"
	}
}

const IsConversionRunning = (status: UploadStatus) => (status === "Unzipping" || status === "Cracking" || status === "Converting")

const FileUploadRow = (props: FileUploadRowProps) => {
	const [uploadState, setUploadState] = useState<FileUploadRowState>({
		status: "Waiting",
		percent: 0,
		conversionId: "",
		errorMessage: "",
		fileName: "",
	})
	const status = uploadState.status
	const percent = uploadState.percent
	const conversionId = uploadState.conversionId
	const { logOut } = useContext(AppContext)
	const fileName = uploadState.fileName
	const [editingBook, setEditingBook] = useState<Book>()
	const onStatusChanged = props.onStatusChanged
	const id = props.id

	const uploadFile = (files: FileList | null) => {
		if (!files?.length || !(files[0].name.endsWith(".aax") || files[0].name.endsWith(".zip"))) {
			return
		}

		const file = files[0]
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
				if (request.responseText) {
					const ret = Api.parseJson(JSON.parse(request.responseText) as ApiMessage)

					if (ret instanceof UploadResponse) {
						onStatusChanged(id, ret.converterStatus)
						setUploadState(prev => ({ ...prev, conversionId: ret.conversionId, percent: 0, status: ret.converterStatus }))
					}
					else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
						logOut(ret.message)
					}
					else {
						logOut("Received an unexpected response")
					}
				}
				else {
					logOut("Received an unexpected response")
				}
			}
		}
		request.send(data)
	}

	useEffect(() => {
		async function getConversionUpdate() {
			const ret = await Api.conversionUpdate(conversionId, percent, ToConverterStatus(status))

			if (ret instanceof ConversionUpdateResponse) {
				const newStatus: UploadStatus = ret.converterStatus === "Complete" ? "Editing" : ret.converterStatus

				onStatusChanged(id, newStatus)
				setUploadState({ percent: ret.conversionPercent, status: newStatus, conversionId, errorMessage: ret.errorMessage, fileName })

				if (newStatus === "Editing") {
					setEditingBook(ret.book)
				}
			}
			else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
				logOut(ret.message)
			}
			else {
				logOut("Received an unexpected response")
			}
		}

		if (conversionId && IsConversionRunning(status)) {
			void getConversionUpdate()
		}
	}, [status, percent, setUploadState, conversionId, logOut, fileName, onStatusChanged, id])

	if (status === "Waiting") {
		return (
			<div>
				<form>
					<div>
						<input type="file" required={true} placeholder="Specify File" accept=".aax,.zip" onChange={e => { uploadFile(e.currentTarget.files) }} />
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
		return (
			<div>
				<div>
					{fileName}
				</div>
				<div>
					<Line percent={percent} strokeWidth={1} strokeColor={status === "Error" ? "#FF0000" : IsConversionRunning(status) ? "#0000FF" : "#00FF00"} />
				</div>
				<div>
					{Math.round(percent)}
					%&nbsp;
					{status}
					...
				</div>
				{status === "Error" && (
					<div className={styles.error}>
						<div>
							{uploadState.errorMessage}
						</div>
					</div>
				)}
			</div>
		)
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
						<li>Zip file containing mp3s of a book</li>
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