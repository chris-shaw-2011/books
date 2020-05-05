import React from "react"
import styles from "./Alert.module.scss"
import classnames from "classnames"

interface Props {
   children: string,
   variant: string,
}

export default (props: Props) => (
   <div className={classnames(styles.alert, styles[props.variant])}>{props.children}</div>
)