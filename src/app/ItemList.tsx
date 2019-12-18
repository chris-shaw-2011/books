import React, { Fragment, useState, useContext } from "react"
import Directory from "../shared/Directory"
import Book, { Status } from "../shared/Book"
import { ItemType } from "../shared/ItemType"
import FolderOpen from "./svg/FolderOpen"
import FolderClosed from "./svg/FolderClosed"
import classnames from "classnames"
import Highlighter from "react-highlight-words"
import { Dropdown, DropdownButton } from "react-bootstrap"
import LoggedInAppContext from "./LoggedInAppContext"
import Unauthorized from "../shared/api/Unauthorized"
import AccessDenied from "../shared/api/AccessDenied"
import Api from "./Api"
import Books from "../shared/api/Books"
import Loading from "./Loading"

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
   const [changingStatus, setChangingStatus] = useState(false)
   const changeBookStatus = async (status: Status) => {
      setChangingStatus(true)

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
      <div className={classnames("book", "item", props.className)}>
         <a className="inner" href={props.book.download} onClick={e => e.stopPropagation()}>
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
               </div>
            </div>
         </a>
         {!changingStatus ?
            <DropdownButton title={props.book.status} id={props.book.id} onClick={(e: any) => { (e as Event).stopPropagation(); }}>
               {
                  Object.values(Status).map(i => {
                     if (i !== props.book.status) {
                        return <Dropdown.Item key={i} onClick={(e: any) => { const evt = e as Event; evt.preventDefault(); evt.stopPropagation(); changeBookStatus(i) }}>Mark {i}</Dropdown.Item>
                     }

                     return undefined
                  })
               }
            </DropdownButton> : <Loading text="Changing Status..." />
         }
      </div>
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
      <div className={classnames("directory", "item", props.className)} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
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