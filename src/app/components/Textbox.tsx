import React from "react"
import classnames from "classnames"
import styles from "./Textbox.module.scss"

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {

}

export default (props: Props) => {
   return <input {...props} type="text" className={classnames(styles.textbox, props.className)} />
}