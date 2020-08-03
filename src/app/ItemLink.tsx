import React from "react"
import Directory from "../shared/Directory"
import Book from "../shared/Book"
import BookLink from "./BookLink"
import DirectoryLink from "./DirectoryLink"
import { ItemType } from "../shared/ItemType"
import Books from "../shared/api/Books"

interface ItemLinkProps {
   item: Directory | Book,
   style?: React.CSSProperties,
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
}

export default React.forwardRef<HTMLDivElement, ItemLinkProps>(({ item, className, searchWords, statusChanged, style }, ref) => (
   item.type === ItemType.book ?
      <BookLink book={item} className={className} searchWords={searchWords} statusChanged={statusChanged} style={style} ref={ref} /> :
      <DirectoryLink directory={item} className={className} searchWords={searchWords} statusChanged={statusChanged} style={style} ref={ref} />
))