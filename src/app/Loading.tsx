import React from "react"
import { Spinner } from "react-bootstrap"

const Loading: React.FC = () => {
   return (
      <div className="loading">
         <div className="inner">
            <Spinner animation="border" role="status" className="spinner" /><div className="text">Loading...</div>
         </div>
      </div>
   )
}

export default Loading;