import { Modal } from "react-bootstrap"
import { type ModalDialogProps } from "react-bootstrap/ModalDialog"
import classnames from "classnames"
import styles from "./ModalDialog.module.scss"

const ModalDialog = (props: ModalDialogProps) => {
	return <Modal.Dialog {...props} className={classnames(props.className, styles.modalDialog)}>{props.children}</Modal.Dialog>
}

export default ModalDialog