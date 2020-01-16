import React from "react"
import { Spinner } from "react-bootstrap"

interface Props {
   text?: string
}

export default (props: Props) => {
   return (
      <div className="loading">
         <div className="inner">
            <Spinner animation="border" role="status" className="spinner" /><div className="text">{props.text ? props.text : "Loading..."}</div>
         </div>
      </div>
   )
}
