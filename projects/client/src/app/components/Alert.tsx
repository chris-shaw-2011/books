import styles from "./Alert.module.scss"
import classnames from "classnames"

interface Props {
   children: string,
   variant: string,
}

const Alert = (props: Props) => (
   <div className={classnames(styles.alert, styles[props.variant])}>{props.children}</div>
)

export default Alert