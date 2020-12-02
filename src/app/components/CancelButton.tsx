import Button from "./Button"
import classnames from "classnames"
import styles from "./CancelButton.module.scss"

export default (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
   <Button {...props} className={classnames(props.className, styles.cancelButton)}>{props.value ?? "Cancel"}</Button>
)