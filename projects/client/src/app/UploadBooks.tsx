import { Line } from "rc-progress"
import { useContext, useEffect, useState, useCallback } from "react"
import { ListGroup, Modal } from "react-bootstrap"
import { v4 as uuid } from "uuid"
import { AccessDenied, ConversionUpdateResponse, Unauthorized, UploadResponse, ConverterStatus, Book, ApiMessage } from "@books/shared"
import Api from "./api/LoggedInApi"
import LoggedInAppContext from "./LoggedInAppContext"
import OverlayComponent from "./components/OverlayComponent"
import CancelButton from "./components/CancelButton"
import styles from "./UploadBooks.module.scss"
import BookLink from "./BookLink"
import classnames from "classnames"
import ModalDialog from "./components/ModalDialog"

enum UploadStatus {
	Pending = "Pending",
	Uploading = "Uploading",
	Converting = "Converting",
	Editing = "Editing",
	Complete = "Complete",
	Error = "Error",
}

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
	forceUpdate?: unknown,
	converterStatus: ConverterStatus,
	fileName: string,
}

const FileUploadRow = (props: FileUploadRowProps) => {
	const [uploadState, setUploadState] = useState<FileUploadRowState>({ status: UploadStatus.Pending, percent: 0, conversionId: "", errorMessage: "", converterStatus: ConverterStatus.Waiting, fileName: "" })
	const status = uploadState.status
	const percent = uploadState.percent
	const conversionId = uploadState.conversionId
	const context = useContext(LoggedInAppContext)
	const onUnauthorized = context.logOut
	const forceConversionUpdate = uploadState.forceUpdate
	const converterStatus = uploadState.converterStatus
	const fileName = uploadState.fileName
	const [editingBook, setEditingBook] = useState<Book>()
	const onStatusChanged = props.onStatusChanged
	const id = props.id

	const uploadFile = (files: FileList | null) => {
		if (!files || !files.length || !(files[0].name.endsWith(".aax") || files[0].name.endsWith(".zip"))) {

			return
		}

		const file = files[0]
		const request = new XMLHttpRequest()
		const data = new FormData()

		onStatusChanged(id, UploadStatus.Uploading)
		setUploadState(prev => ({ ...prev, percent: 0, status: UploadStatus.Uploading, fileName: file.name }))

		data.append("fileName", file.name)
		data.append("file", file)

		request.open("POST", "/upload", true)
		request.upload.onprogress = e => {
			setUploadState(prev => ({ ...prev, percent: (e.loaded / e.total) * 100, status: UploadStatus.Uploading }))
		}
		request.onreadystatechange = () => {
			if (request.readyState === XMLHttpRequest.DONE) {
				if (request.responseText) {
					const ret = Api.parseJson(JSON.parse(request.responseText) as ApiMessage)

					if (ret instanceof UploadResponse) {
						onStatusChanged(id, UploadStatus.Converting)
						setUploadState(prev => ({ ...prev, conversionId: ret.conversionId, percent: 0, status: UploadStatus.Converting }))
					}
					else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
						onUnauthorized(ret.message)
					}
					else {
						onUnauthorized("Received an unexpected response")
					}
				}
				else {
					onUnauthorized("Received an unexpected response")
				}
			}
		}
		request.send(data)
	}

	useEffect(() => {
		async function getConversionUpdate() {
			const ret = await Api.conversionUpdate(conversionId, percent, converterStatus)

			if (ret instanceof ConversionUpdateResponse) {
				const newStatus = ret.converterStatus === ConverterStatus.Error ? UploadStatus.Error : ret.converterStatus === ConverterStatus.Complete ? UploadStatus.Editing : UploadStatus.Converting

				onStatusChanged(id, newStatus)

				setUploadState({ percent: ret.conversionPercent, status: newStatus, conversionId, errorMessage: ret.errorMessage, forceUpdate: {}, converterStatus: ret.converterStatus, fileName })

				if (newStatus === UploadStatus.Editing) {
					setEditingBook(ret.book)
				}
			}
			else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
				onUnauthorized(ret.message)
			}
			else {
				onUnauthorized("Received an unexpected response")
			}
		}

		if (status === UploadStatus.Converting) {
			void getConversionUpdate()
		}
	}, [status, percent, setUploadState, conversionId, onUnauthorized, forceConversionUpdate, converterStatus, fileName, onStatusChanged, id])

	return (
		<div>
			{status === UploadStatus.Pending ?
				<form>
					<div>
						<input type="file" required={true} placeholder="Specify File" accept=".aax,.zip" onChange={e => uploadFile(e.currentTarget.files)} />
					</div>
				</form>
				: editingBook ?
					<BookLink book={editingBook} searchWords={[]} statusChanged={() => { return }} editOnly={true} onEditComplete={() => onStatusChanged(id, UploadStatus.Complete)} /> :
					<div>
						<div>
							{fileName}
						</div>
						<div>
							<Line percent={percent} strokeWidth={1} strokeColor={status === UploadStatus.Error ? "#FF0000" : status === UploadStatus.Converting || status === UploadStatus.Complete ? "#0000FF" : "#00FF00"} />
						</div>
						<div>
							{Math.round(percent)}% {status !== UploadStatus.Converting ? status : converterStatus}...
						</div>
						{status === UploadStatus.Error &&
							<div className={styles.error} >
								<div>
									{uploadState.errorMessage}
								</div>
							</div>}
					</div>
			}
		</div>
	)
}

const UploadBooks = (props: Props) => {
	const [fileUploadRows, setFileUploadRows] = useState<Map<string, UploadStatus>>(new Map([[uuid(), UploadStatus.Pending]]))
	const onStatusChanged = useCallback((id: string, status: UploadStatus) => {
		setFileUploadRows(prev => {
			const prevStatus = prev.get(id) ?? UploadStatus.Pending

			prev.set(id, status)

			if (prevStatus === UploadStatus.Pending && status !== UploadStatus.Pending) {
				prev.set(uuid(), UploadStatus.Pending)
			}
			else if (status === UploadStatus.Complete && prevStatus !== UploadStatus.Complete) {
				prev.delete(id)
			}

			return new Map<string, UploadStatus>(prev)
		})
	}, [])
	const arr = Array.from(fileUploadRows.entries())

	return (
		<OverlayComponent onClick={props.onClose} className={classnames({ [styles.editingBook]: arr.some(v => v[1] === UploadStatus.Editing) })}>
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