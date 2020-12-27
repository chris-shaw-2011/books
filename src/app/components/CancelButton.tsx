import Button from "./Button"
import classnames from "classnames"
import styles from "./CancelButton.module.scss"

const CancelButton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
   <Button {...props} className={classnames(props.className, styles.cancelButton)}>{props.value ?? "Cancel"}</Button>
)

export default CancelButton