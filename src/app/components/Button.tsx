import React from "react"
import styles from "./Button.module.scss"
import classnames from "classnames"

export default (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
   <button {...props} className={classnames(props.className, styles.button)} />
)