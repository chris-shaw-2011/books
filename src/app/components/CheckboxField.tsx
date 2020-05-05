import React from "react"
import styles from "./CheckboxField.module.scss"

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
   label: string,
}

export default (props: Props) => (
   <label className={styles.checkbox}>
      <input {...props} />
      {props.label}
   </label>
)