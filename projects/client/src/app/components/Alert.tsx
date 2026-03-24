import styles, { type ClassNames } from "./Alert.module.scss"
import classnames from "classnames"

type AlertVariant = Exclude<ClassNames, "alert">

interface Props {
	children: string,
	variant: AlertVariant,
}

const Alert = (props: Props) => (
	<div className={classnames(styles.alert, styles[props.variant])}>{props.children}</div>
)

export default Alert
