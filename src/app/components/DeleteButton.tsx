import Button from "./Button"
import classnames from "classnames"
import styles from "./DeleteButton.module.scss"

export default (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
   <Button {...props} className={classnames(props.className, styles.deleteButton)}>{props.value ?? "Delete"}</Button>
)