import classnames from "classnames"
import styles from "./Textbox.module.scss"

const Textbox = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={classnames(styles.textbox, props.className)} />

export default Textbox
