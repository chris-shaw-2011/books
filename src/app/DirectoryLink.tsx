import classnames from "classnames"
import React, { useState, useEffect } from "react"
import Books from "../shared/api/Books"
import Directory from "../shared/Directory"
import ItemList from "./ItemList"
import FolderClosed from "./svg/FolderClosed"
import FolderOpen from "./svg/FolderOpen"
import Highlighter from "react-highlight-words"
import { CellMeasurerChildProps } from "react-virtualized/dist/es/CellMeasurer"

interface DirectoryProps {
   directory: Directory,
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
   cellMeasurerChildProps?: CellMeasurerChildProps,
   style?: React.CSSProperties,
}

export default (props: DirectoryProps) => {
   // tslint:disable-next-line: no-empty
   const measure = props.cellMeasurerChildProps?.measure || (() => { return })
   const registerChild = props.cellMeasurerChildProps?.registerChild
   const [open, setOpen] = useState(false)
   const displayOpen = open || props.searchWords.length
   const statusChanged = (books: Books) => {
      props.statusChanged(books)
      measure()
   }
   const onClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation()

      if (!props.searchWords.length) {
         setOpen(s => !s)
      }
   }

   useEffect(() => {
      measure()
   }, [open, measure])

   return (
      <div className={classnames("directory", "item", props.className)} onClick={onClick} ref={e => e && registerChild ? registerChild(e) : null} style={props.style}>
         <div className="inner">
            {displayOpen ? <FolderOpen /> : <FolderClosed />}
            <Highlighter searchWords={props.searchWords} textToHighlight={props.directory.name} />
         </div>
         {displayOpen ? <ItemList items={props.directory.items} searchWords={props.searchWords} statusChanged={statusChanged} measure={measure} /> : null}
      </div>
   )
}
