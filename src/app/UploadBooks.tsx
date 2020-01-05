import React, { useState, Fragment, useEffect, useContext } from "react"
import OverlayComponent from "./OverlayComponent"
import { Form, Modal, Button, ListGroup } from "react-bootstrap"
import uuid from "uuid";
import { Line } from "rc-progress"
import Api from "./Api";
import LoggedInAppContext from "./LoggedInAppContext";
import ConversionUpdateResponse from "../shared/api/ConversionUpdateResponse";
import Unauthorized from "../shared/api/Unauthorized";
import AccessDenied from "../shared/api/AccessDenied";
import UploadResponse from "../shared/api/UploadResponse";
import { ConverterStatus } from "../shared/ConverterStatus";

enum UploadStatus {
   Pending = "Pending",
   Uploading = "Uploading",
   Converting = "Converting",
   Complete = "Complete",
   Error = "Error"
}

interface Props {
   onClose: () => void,
}

export default (props: Props) => {
   const [fileUploadRowKeys, setFileUploadRowKeys] = useState([uuid.v4()])
   const onUploadStarted = () => {
      //Add a new row
      setFileUploadRowKeys(prev => {
         return [...prev, uuid.v4()]
      })
   }
   const onComplete = (key: string) => {
      //Remove the row
      setFileUploadRowKeys(prev => {
         return prev.filter(i => i !== key)
      })
   }

   return (
      <OverlayComponent onClose={props.onClose}>
         <Modal.Dialog className="upload">
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
                  {fileUploadRowKeys.map(k => <ListGroup.Item><FileUploadRow onUploadStarted={onUploadStarted} key={k} onComplete={() => onComplete(k)} /></ListGroup.Item>)}
               </ListGroup>
            </Modal.Body>
            <Modal.Footer>
               <Button variant="secondary" onClick={props.onClose}>Close</Button>
            </Modal.Footer>
         </Modal.Dialog>
      </OverlayComponent>
   )
}

interface FileUploadRowProps {
   onUploadStarted: () => void,
   onComplete: () => void,
}

interface FileUploadRowState {
   status: UploadStatus,
   percent: number,
   conversionId: string,
   errorMessage: string,
   forceUpdate: {},
   converterStatus: ConverterStatus,
   fileName: string,
}

const FileUploadRow = (props: FileUploadRowProps) => {
   const [uploadState, setUploadState] = useState<FileUploadRowState>({ status: UploadStatus.Pending, percent: 0, conversionId: "", errorMessage: "", forceUpdate: {}, converterStatus: ConverterStatus.Waiting, fileName: "" })
   const status = uploadState.status
   const percent = uploadState.percent
   const conversionId = uploadState.conversionId
   const context = useContext(LoggedInAppContext)
   const onUnauthorized = context.logOut
   const onComplete = props.onComplete
   const forceConversionUpdate = uploadState.forceUpdate
   const converterStatus = uploadState.converterStatus
   const fileName = uploadState.fileName

   const uploadFile = (files: FileList | null) => {
      if (!files || !files.length || !(files[0].name.endsWith(".aax") || files[0].name.endsWith(".zip"))) {

         console.log("wrong file type")
         return;
      }

      const file = files[0]
      const request = new XMLHttpRequest()
      var data = new FormData()

      setUploadState(prev => { return { ...prev, uploadState, percent: 0, status: UploadStatus.Uploading, fileName: file.name } })
      props.onUploadStarted()

      data.append("fileName", file.name)
      data.append("file", file)

      request.open("POST", "/upload", true)
      request.upload.onprogress = (e) => {
         setUploadState(prev => { return { ...prev, percent: (e.loaded / e.total) * 100, status: UploadStatus.Uploading } })
      }
      request.onreadystatechange = () => {
         if (request.readyState === XMLHttpRequest.DONE) {
            if (request.response) {
               const ret = Api.parseJson(JSON.parse(request.response))

               if (ret instanceof UploadResponse) {
                  setUploadState(prev => { return { ...prev, conversionId: ret.conversionId, percent: 0, status: UploadStatus.Converting } })
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
         var ret = await Api.conversionUpdate(conversionId, percent, converterStatus)

         if (ret instanceof ConversionUpdateResponse) {
            var status = ret.converterStatus === ConverterStatus.Error ? UploadStatus.Error : ret.converterStatus === ConverterStatus.Complete ? UploadStatus.Complete : UploadStatus.Converting
            setUploadState({ percent: ret.conversionPercent, status: status, conversionId: conversionId, errorMessage: ret.errorMessage, forceUpdate: {}, converterStatus: ret.converterStatus, fileName: fileName, })

            if (status === UploadStatus.Complete) {
               setTimeout(onComplete, 1000);
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
         getConversionUpdate()
      }
   }, [status, percent, setUploadState, conversionId, onUnauthorized, onComplete, forceConversionUpdate, converterStatus, fileName])

   return (
      <Form>
         <Form.Row>
            {status === UploadStatus.Pending ?
               <Fragment>
                  <div>
                     <Form.Control type="file" required placeholder="Specify File" accept=".aax,.zip" onChange={(e: React.ChangeEvent<HTMLInputElement>) => uploadFile(e.currentTarget.files)} />
                  </div>
               </Fragment> :
               <Fragment>
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
                        <div style={{ maxHeight: "75px", overflow: "auto", maxWidth: "90%", color: "white", backgroundColor: "black" }}>
                           <div style={{ whiteSpace: "pre-wrap" }}>
                              {uploadState.errorMessage}
                           </div>
                        </div>}
                  </div>
               </Fragment>
            }
         </Form.Row>
      </Form>
   )
}