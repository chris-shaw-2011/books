import styles from "./Button.module.scss"
import classnames from "classnames"

const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
	<button {...props} className={classnames(props.className, styles.button)} type={props.type ?? "button"} />
)

export default Button
