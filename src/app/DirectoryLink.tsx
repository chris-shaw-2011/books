import classnames from "classnames"
import { useState, forwardRef } from "react"
import Books from "../shared/api/Books"
import Directory from "../shared/Directory"
import FolderClosed from "./svg/FolderClosed"
import FolderOpen from "./svg/FolderOpen"
import Highlighter from "react-highlight-words"
import ItemLink from "./ItemLink"
import itemStyles from "./ItemLink.module.scss"

interface DirectoryProps {
   directory: Directory,
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
   style?: React.CSSProperties,
   toggleAlwaysRender?:(key:(string | number)) => void
}

const DirectoryLink = forwardRef<HTMLDivElement, DirectoryProps>((props: DirectoryProps, ref) => {
   const [open, setOpen] = useState(false)
   const displayOpen = open || props.searchWords.length
   const onClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation()

      if (!props.searchWords.length) {
         if (props.toggleAlwaysRender) {
            props.toggleAlwaysRender(props.directory.id)
         }

         setOpen(s => !s)
      }
   }

   return (
      <div className={classnames("directory", "item", props.className)} onClick={onClick} style={props.style} ref={ref}>
         <div className={classnames("inner", itemStyles.inner)}>
            {displayOpen ? <FolderOpen /> : <FolderClosed />}
            <Highlighter searchWords={props.searchWords} textToHighlight={props.directory.name} />
         </div>
         {displayOpen ? <>
            {props.directory.items.map(item => <ItemLink item={item} key={item.id} searchWords={props.searchWords} statusChanged={props.statusChanged} />)}
         </> : null}
      </div>
   )
})

DirectoryLink.displayName = "DirectoryLink"

export default DirectoryLink