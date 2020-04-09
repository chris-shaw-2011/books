import React from "react"

interface Props {
   style?: React.CSSProperties,
   className?: string,
}

export default (props: Props) => (
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 172 172" style={props.style} className={props.className}>
      <path d="M13.76,58.48l72.24,75.68l72.24,-75.68z" />
   </svg>
)