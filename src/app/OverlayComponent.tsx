import React from "react"

interface Props {
   onClose?: () => void,
   children: React.ReactNode
}

export default (props: Props) => {
   return (
      <div className="overlay" onClick={e => props.onClose && e.target === e.currentTarget && props.onClose()}>
         <div>
            {props.children}
         </div>
      </div>
   )
}
