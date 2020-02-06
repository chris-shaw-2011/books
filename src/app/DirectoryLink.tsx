import classnames from "classnames"
import React, { useState } from "react"
import AnimateHeight from "react-animate-height"
import Books from "../shared/api/Books"
import Directory from "../shared/Directory"
import ItemList from "./ItemList"
import FolderClosed from "./svg/FolderClosed"
import FolderOpen from "./svg/FolderOpen"

interface DirectoryProps {
   directory: Directory,
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
}

export default (props: DirectoryProps) => {
   const [state, setState] = useState({ open: false, animating: false })
   const onClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation()

      if (!props.searchWords.length) {
         setState(s => ({ ...s, open: !s.open, animating: true }))
      }
   }

   return (
      <div className={classnames("directory", "item", props.className)} onClick={onClick}>
         <div className="inner">
            {state.open || props.searchWords.length ? <FolderOpen /> : <FolderClosed />}
            <div>{props.directory.name}</div>
         </div>
         {(state.open || props.searchWords.length || state.animating) && <AnimateHeight onAnimationEnd={() => setState(s => ({ ...s, animating: false }))} height={state.open || props.searchWords.length ? "auto" : 0}>
            <ItemList items={props.directory.items} searchWords={props.searchWords} statusChanged={props.statusChanged} />
         </AnimateHeight>}
      </div>
   )
}
