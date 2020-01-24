import React, { Fragment } from "react"
import Books from "../shared/api/Books"
import Book from "../shared/Book"
import Directory from "../shared/Directory"
import { ItemType } from "../shared/ItemType"
import BookLInk from "./BookLInk"
import DirectoryLink from "./DirectoryLink"

interface Props {
   items: (Directory | Book)[],
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
}

export default (props: Props) => {
   return (
      <Fragment>
         {props.items.map(i => {
            if (i.type === ItemType.book) {
               return <BookLInk book={i} className={props.className} key={i.id} searchWords={props.searchWords} statusChanged={props.statusChanged} />
            }
            else {
               return <DirectoryLink directory={i} className={props.className} key={i.id} searchWords={props.searchWords} statusChanged={props.statusChanged} />
            }
         })}
      </Fragment>
   )
}
