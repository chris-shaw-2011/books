import React from "react"
import Textbox from "./Textbox"
import styles from "./TextboxField.module.scss"

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
   label: string,
}

export default (props: Props) => (
   <label className={styles.textboxField}>
      <div>
         {props.label}
      </div>
      <Textbox {...props} />
   </label>
)