import React from "react"
import styles from "./OverlayComponent.module.scss"
import classnames from "classnames"

export default (props: React.HTMLAttributes<HTMLDivElement>) => {
   return (
      <div {...props} className={classnames(styles.overlay, props.className)} onClick={e => props.onClick && e.target === e.currentTarget && props.onClick(e)}>
         <div>
            {props.children}
         </div>
      </div>
   )
}
