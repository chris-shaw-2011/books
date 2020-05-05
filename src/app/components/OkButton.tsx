import React from "react"
import Button from "./Button"
import classnames from "classnames"
import styles from "./OkButton.module.scss"

export default (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
   <Button {...props} type="submit" className={classnames(props.className, styles.okButton)}>{props.value}</Button>
)