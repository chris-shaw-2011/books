import classnames from "classnames"
import styles from "./ModalDialog.module.scss"

const ModalDialog = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div {...props} className={classnames(className, styles.modalDialog)}>
		<div className={styles.content}>
			{children}
		</div>
	</div>
)

export const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} className={classnames(className, styles.header)} />

export const ModalTitle = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} className={classnames(className, styles.title)} />

export const ModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} className={classnames(className, styles.body)} />

export const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} className={classnames(className, styles.footer)} />

export default ModalDialog
