import React from "react"
import Textbox from "./Textbox"
import styles from "./TextboxField.module.scss"
import classnames from "classnames"

export enum LabelLocation {
   Top,
   Left,
}

export interface TextboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
   label: string,
   labelLocation?: LabelLocation
}

export default (props: TextboxFieldProps) => {
   const { label, labelLocation, ...passThroughProps } = props

   return (
      <label className={classnames(styles.textboxField, { [styles.labelLeft]: labelLocation === LabelLocation.Left })}>
         {labelLocation !== LabelLocation.Left ?
            <div>
               {label}
            </div> :
            <span>{label}</span>}
         <Textbox {...passThroughProps} />
      </label>
   )
}