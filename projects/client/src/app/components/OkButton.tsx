import Button from "./Button"
import classnames from "classnames"
import styles from "./OkButton.module.scss"

const OkButton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
   <Button type="submit" {...props} className={classnames(props.className, styles.okButton)}>{props.value}</Button>
)

export default OkButton