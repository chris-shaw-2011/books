import classnames from "classnames"
import React, { useContext, useState } from "react"
import { Dropdown, DropdownButton } from "react-bootstrap"
import Highlighter from "react-highlight-words"
import AccessDenied from "../shared/api/AccessDenied"
import Books from "../shared/api/Books"
import Unauthorized from "../shared/api/Unauthorized"
import Book, { Status } from "../shared/Book"
import Api from "./Api"
import Loading from "./Loading"
import LoggedInAppContext from "./LoggedInAppContext"
import moment from "moment"

interface BookProps {
   book: Book,
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
}

export default (props: BookProps) => {
   const context = useContext(LoggedInAppContext)
   const [changingStatus, setChangingStatus] = useState(false)
   const changeBookStatus = async (status: Status) => {
      setChangingStatus(true)

      const ret = await Api.changeBookStatus(props.book.id, status, context.token)

      if (ret instanceof Books) {
         props.statusChanged(ret)
      }
      else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
         context.logOut(ret.message)
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
               <div className="uploadTime">Uploaded: {moment(props.book.uploadTime).format("M/D/YYYY h:mm:ss A")}</div>
               <div />
            </div>
         </a>
         {!changingStatus ?
            <DropdownButton title={props.book.status} id={props.book.id} onClick={(e: any) => { (e as Event).stopPropagation() }}>
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

function readableDuration(secNum: number) {
   const hours = Math.floor(secNum / 3600)
   const minutes = Math.floor((secNum - (hours * 3600)) / 60)
   const seconds = Math.floor(secNum - (hours * 3600) - (minutes * 60))

   return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}
