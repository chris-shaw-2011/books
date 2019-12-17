import React, { Fragment, useState, useContext } from "react"
import Directory from "../shared/Directory"
import Book, { Status } from "../shared/Book"
import { ItemType } from "../shared/ItemType"
import FolderOpen from "./svg/FolderOpen"
import FolderClosed from "./svg/FolderClosed"
import classnames from "classnames"
import Highlighter from "react-highlight-words"
import { Button } from "react-bootstrap"
import LoggedInAppContext from "./LoggedInAppContext"
import Unauthorized from "../shared/api/Unauthorized"
import AccessDenied from "../shared/api/AccessDenied"
import Api from "./Api"
import Books from "../shared/api/Books"

interface Props {
   items: Array<Directory | Book>,
   className?: string,
   searchWords: Array<string>,
   statusChanged: (books: Books) => void,
}

const ItemList: React.FC<Props> = (props: Props) => {
   return (
      <Fragment>
         {props.items.map(i => {
            if (i.type === ItemType.book) {
               return <BookLink book={i} className={props.className} key={i.id} searchWords={props.searchWords} statusChanged={props.statusChanged} />
            }
            else {
               return <DirectoryLink directory={i} className={props.className} key={i.id} searchWords={props.searchWords} statusChanged={props.statusChanged} />
            }
         })}
      </Fragment>
   )
}

interface BookProps {
   book: Book,
   className?: string,
   searchWords: Array<string>,
   statusChanged: (books: Books) => void,
}

const BookLink: React.FC<BookProps> = (props: BookProps) => {
   const context = useContext(LoggedInAppContext)
   const changeBookStatus = async (status: Status) => {
      var ret = await Api.changeBookStatus(props.book.id, status, context.token)

      if (ret instanceof Books) {
         props.statusChanged(ret)
      }
      else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
         context.logOut(ret.message);
      }
      else {
         context.logOut("Something unexpected happened")
      }
   }

   return (
      <a className={classnames("book", "item", props.className)} href={props.book.download} key={props.book.id}>
         <div className="inner">
            <img src={props.book.cover} alt="cover" />
            <div>
               <div className="title"><Highlighter searchWords={props.searchWords} textToHighlight={props.book.name} /></div>
               <div className="comment"><Highlighter searchWords={props.searchWords} textToHighlight={props.book.comment} /></div>
               <div className="author"><Highlighter searchWords={props.searchWords} textToHighlight={props.book.author} />, {props.book.year}</div>
               <div className="size">
                  {props.book.duration ? `${readableDuration(props.book.duration)}, ` : ""}
                  {Math.round(props.book.numBytes / 1024 / 1024).toLocaleString()} MB
               </div>
               <div>
                  {props.book.status === Status.Unread ?
                     <Button onClick={(e: any) => { (e as Event).preventDefault(); changeBookStatus(Status.Read) }}>Mark Read</Button> :
                     <Button onClick={(e: any) => { (e as Event).preventDefault(); changeBookStatus(Status.Unread) }}>Mark Unread</Button>
                  }
               </div>
            </div>
         </div>
      </a>
   )
}

interface DirectoryProps {
   directory: Directory,
   className?: string,
   searchWords: Array<string>,
   statusChanged: (books: Books) => void,
}

const DirectoryLink: React.FC<DirectoryProps> = (props: DirectoryProps) => {
   const [open, setOpen] = useState(false)

   return (
      <div className={classnames("directory", "item", props.className)} onClick={(e) => { e.stopPropagation(); setOpen(!open) }} key={props.directory.id}>
         <div className="inner">
            {open || props.searchWords.length ? <FolderOpen /> : <FolderClosed />}
            <div>{props.directory.name}</div>
         </div>
         {open || props.searchWords.length ? <ItemList items={props.directory.items} searchWords={props.searchWords} statusChanged={props.statusChanged} /> : null}
      </div>
   )
}

function readableDuration(sec_num: number) {
   var hours = Math.floor(sec_num / 3600);
   var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
   var seconds = Math.floor(sec_num - (hours * 3600) - (minutes * 60));

   return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}


export default ItemList;