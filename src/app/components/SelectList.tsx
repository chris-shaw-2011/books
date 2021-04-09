import { ReactNodeArray, ReactNode, useState } from "react"
import styles from "./SelectList.module.scss"
import classnames from "classnames"
import AnimateHeight from "react-animate-height"

interface Props {
   className?: string,
   children: ReactNode | ReactNodeArray,
   open: boolean,
}

const SelectList = (props: Props) => {
   const [hidden, setHidden] = useState(!props.open ? styles.hidden : "")

   return (
      <AnimateHeight duration={250} height={props.open ? "auto" : 0} className={classnames(styles.selectList, props.className, hidden)} onAnimationEnd={({ newHeight }) => newHeight ? setHidden("") : setHidden(styles.hidden)}>
         {props.children}
      </AnimateHeight>
   )
}

export const SelectListItem = (props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
   <div {...props} className={classnames(styles.item, props.className)}>
      {props.children}
   </div>
)

export default SelectList