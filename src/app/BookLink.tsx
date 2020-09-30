import classnames from "classnames"
import React, { useContext, useState, forwardRef } from "react"
import AppContext from "./LoggedInAppContext"
import { Dropdown, DropdownButton } from "react-bootstrap"
import Highlighter from "react-highlight-words"
import AccessDenied from "../shared/api/AccessDenied"
import Books from "../shared/api/Books"
import Unauthorized from "../shared/api/Unauthorized"
import Book, { Status } from "../shared/Book"
import Api from "./api/LoggedInApi"
import Loading from "./Loading"
import Textbox from "./components/Textbox"
import moment from "dayjs"
import Edit from "./svg/Edit"
import TextareaAutosize from "react-textarea-autosize"
import CancelButton from "./components/CancelButton"
import OkButton from "./components/OkButton"
import itemStyles from "./ItemLink.module.scss"
import styles from "./BookLink.module.scss"
import TextboxField, { LabelLocation, TextboxFieldProps } from "./components/TextboxField"
import LoggedInApi from "./api/LoggedInApi"
import UpdateBookResponse from "../shared/api/UpdateBookResponse"
import Alert from "./components/Alert"

enum EditStatus {
   ReadOnly,
   Editing,
   Saving,
}

interface BookProps {
   book: Book,
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
   style?: React.CSSProperties,
   editOnly?: boolean,
   onEditComplete?: () => void,
}

export default forwardRef<HTMLDivElement, BookProps>((props, ref) => {
   const context = useContext(AppContext)
   const [changingStatus, setChangingStatus] = useState(false)
   const [editingState, setEditingState] = useState<{ status: EditStatus, alertMessage?: string }>({ status: props.editOnly ? EditStatus.Editing : EditStatus.ReadOnly })
   const [newTitle, setNewTitle] = useState(props.book.name)
   const [newDescription, setNewDescription] = useState(props.book.comment)
   const [newAuthor, setNewAuthor] = useState(props.book.author)
   const [newYear, setNewYear] = useState(props.book.year)
   const [newNarrator, setNewNarrator] = useState(props.book.narrator)
   const [newGenre, setNewGenre] = useState(props.book.genre)
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
   const bookClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      e.stopPropagation()

      if (editing) {
         e.preventDefault()
      }
   }

   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget

      event.preventDefault()
      event.stopPropagation()

      if (form.checkValidity()) {
         const newBook = new Book(props.book)

         newBook.genre = newGenre
         newBook.name = newTitle
         newBook.year = newYear
         newBook.comment = newDescription
         newBook.author = newAuthor
         newBook.narrator = newNarrator

         setEditingState({ status: EditStatus.Saving })

         const ret = await LoggedInApi.updateBook(context.token, newBook, props.book)

         if (ret instanceof UpdateBookResponse) {
            if (ret.books) {
               context.updateBooks(ret.books.directory)

               setEditingState({ status: EditStatus.ReadOnly })

               if (props.onEditComplete) {
                  props.onEditComplete()
               }
            }
            else {
               setEditingState({ status: EditStatus.Editing, alertMessage: ret.message })
            }
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            context.logOut(ret.message)
         }
         else {
            context.logOut("Something unexpected happened")
         }
      }
   }
   const onCancel = () => {
      if (props.onEditComplete) {
         props.onEditComplete()
      }

      setEditingState({ status: EditStatus.ReadOnly })
   }

   const editing = editingState.status === EditStatus.Editing || editingState.status === EditStatus.Saving
   const alertMessage = editingState.alertMessage

   return (
      <div className={classnames({ [styles.editing]: editing }, props.className)} style={props.style} ref={ref} onClick={e => e.stopPropagation()}>
         <form onSubmit={handleSubmit}>
            <Inner className={classnames(itemStyles.inner, styles.inner)} href={props.book.download} onClick={bookClicked} editing={editing}>
               <img src={props.book.cover} alt="cover" />
               <div>
                  {alertMessage ? <Alert variant="danger">{alertMessage}</Alert> : null}
                  <div className={classnames(styles.title, styles.editable)}>
                     <EditableTextbox editing={editing} defaultValue={props.book.name} placeholder="Title" onChange={e => setNewTitle(e.target.value)} searchWords={props.searchWords} />
                     {!editing && context.token.user.isAdmin ? <Edit onClick={e => { e.stopPropagation(); e.preventDefault(); setEditingState({ status: EditStatus.Editing }) }} /> : null}
                  </div>
                  <div className={classnames(styles.description, styles.editable)}>
                     {editing ? <TextareaAutosize defaultValue={props.book.comment} minRows={3} placeholder="Description" required={true} onChange={e => setNewDescription(e.target.value)} /> : <Highlighter searchWords={props.searchWords} textToHighlight={props.book.comment} sanitize={sanitize} />}
                  </div>
                  <div className={classnames(styles.author, styles.editable)}>
                     <EditableTextboxField editing={editing} label="Author" defaultValue={props.book.author} placeholder="Author" onChange={e => setNewAuthor(e.target.value)} searchWords={props.searchWords} />,&nbsp;
                     <EditableTextbox editing={editing} defaultValue={props.book.year} placeholder="Year" type="number" min="1700" max={new Date().getFullYear()} size={4} className={styles.year} onChange={e => setNewYear(parseInt(e.target.value, 10))} searchWords={props.searchWords} />
                  </div>
                  <div className={classnames(styles.narrator, styles.editable)}>
                     <EditableTextboxField editing={editing} label="Narrator" defaultValue={props.book.narrator} placeholder="Narrator" onChange={e => setNewNarrator(e.target.value)} searchWords={props.searchWords} />
                  </div>
                  <div className={classnames(styles.genre, styles.editable)}>
                     <EditableTextboxField editing={editing} label="Genre" defaultValue={props.book.genre} placeholder="Genre" onChange={e => setNewGenre(e.target.value)} searchWords={props.searchWords} />
                  </div>
                  <div className={styles.size}>
                     <label>
                        <span>Length</span> <span>{props.book.duration ? `${readableDuration(props.book.duration)}, ` : ""}{Math.round(props.book.numBytes / 1024 / 1024).toLocaleString()} MB</span>
                     </label>
                  </div>
                  <div className={styles.uploadTime}>
                     <label>
                        <span>Uploaded</span> <span>{moment(props.book.uploadTime).format("M/D/YYYY h:mm:ss A")}</span>
                     </label>
                  </div>
                  {editingState.status === EditStatus.Editing ?
                     <>
                        <CancelButton value="Cancel" onClick={onCancel} />
                        <OkButton value="Save" />
                     </> : editingState.status === EditStatus.Saving ?
                        <Loading text="Saving..." /> : null}
               </div>
            </Inner>
         </form>
         {!changingStatus && !editing ?
            <DropdownButton title={props.book.status} id={props.book.id} onClick={(e: any) => { (e as Event).stopPropagation() }}>
               {
                  Object.values(Status).map(i => {
                     if (i !== props.book.status) {
                        return <Dropdown.Item key={i} onClick={(e: any) => { const evt = e as Event; evt.preventDefault(); evt.stopPropagation(); changeBookStatus(i) }}>Mark {i}</Dropdown.Item>
                     }

                     return undefined
                  })
               }
            </DropdownButton> : !editing ? <Loading text="Changing Status..." /> : null
         }
      </div>
   )
})

interface InnerProps extends React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> {
   editing: boolean,
}

// tslint:disable-next-line: variable-name
const Inner = ({ editing, children, ...passThroughProps }: InnerProps) => {
   if (editing) {
      return (
         <div className={passThroughProps.className}>
            {children}
         </div>
      )
   }
   else {
      return (
         <a {...passThroughProps}>
            {children}
         </a>
      )
   }
}

interface EditableTextboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
   editing: boolean,
   searchWords: string[],
}

// tslint:disable-next-line: variable-name
const EditableTextbox = ({ editing, searchWords, ...passThroughProps }: EditableTextboxProps) => (
   editing ? <Textbox required={true} {...passThroughProps} /> : <Highlighter searchWords={searchWords} textToHighlight={passThroughProps.defaultValue?.toString() ?? ""} sanitize={sanitize} />
)

interface EditableTextboxFieldProps extends TextboxFieldProps {
   editing: boolean,
   searchWords: string[],
}

// tslint:disable-next-line: variable-name
const EditableTextboxField = ({ editing, searchWords, ...passThroughProps }: EditableTextboxFieldProps) => (
   editing ? <TextboxField required={true} {...passThroughProps} labelLocation={LabelLocation.Left} /> : <label><span>{passThroughProps.label}</span> <Highlighter searchWords={searchWords} textToHighlight={passThroughProps.defaultValue?.toString() ?? ""} sanitize={sanitize} /></label>
)

function readableDuration(secNum: number) {
   const hours = Math.floor(secNum / 3600)
   const minutes = Math.floor((secNum - (hours * 3600)) / 60)
   const seconds = Math.floor(secNum - (hours * 3600) - (minutes * 60))

   return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}

const sanitize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")