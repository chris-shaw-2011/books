import classnames from "classnames"
import { useContext, useState, forwardRef, useEffect } from "react"
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
import UpdateBookResponse from "../shared/api/UpdateBookResponse"
import Alert from "./components/Alert"
import FolderOpen from "./svg/FolderOpen"
import FolderClosed from "./svg/FolderClosed"
import Directory from "../shared/Directory"
import { ItemType } from "../shared/ItemType"
import Button from "./components/Button"

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

const BookLink = forwardRef<HTMLDivElement, BookProps>((props: BookProps, ref) => {
   const context = useContext(AppContext)
   const [changingStatus, setChangingStatus] = useState(false)
   const [editingState, setEditingState] = useState<{ status: EditStatus, alertMessage?: string }>({ status: props.editOnly ? EditStatus.Editing : EditStatus.ReadOnly })
   const [newTitle, setNewTitle] = useState(props.book.name)
   const [newDescription, setNewDescription] = useState(props.book.comment)
   const [newAuthor, setNewAuthor] = useState(props.book.author)
   const [newYear, setNewYear] = useState(props.book.year)
   const [newNarrator, setNewNarrator] = useState(props.book.narrator)
   const [newGenre, setNewGenre] = useState(props.book.genre)
   const [showPathOptions, setShowPathOptions] = useState(false)
   const [newPath, setNewPath] = useState<undefined | string>()
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
         newBook.folderPath = newPath || props.book.folderPath

         setEditingState({ status: EditStatus.Saving })

         const ret = await Api.updateBook(context.token, newBook, props.book)

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
   const addNewFolder = async (path: string, folderName: string) => {
      const ret = await Api.addFolder(context.token, path, folderName)

      if (ret instanceof Books) {
         context.updateBooks(ret.directory)
      }
      else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
         context.logOut(ret.message)
      }
      else {
         context.logOut("Something unexpected happened")
      }
   }

   useEffect(() => {
      if (showPathOptions) {
         document.getElementsByClassName(styles.folderList)[0].getElementsByClassName(styles.selected)[0].scrollIntoView({ behavior: "auto", block: "nearest" })
      }
   }, [showPathOptions])

   return (
      <div className={classnames({ [styles.editing]: editing }, props.className)} style={props.style} ref={ref} onClick={e => e.stopPropagation()}>
         <form onSubmit={handleSubmit}>
            <Inner className={classnames(itemStyles.inner, styles.inner)} href={props.book.download} onClick={bookClicked} editing={editing}>
               <img src={props.book.cover} alt="cover" />
               <div>
                  {alertMessage ? <Alert variant="danger">{alertMessage}</Alert> : null}
                  <div className={classnames(styles.title, styles.editable)}>
                     <EditableTextbox editing={editing} defaultValue={props.book.name} placeholder="Title" onChange={e => setNewTitle(e.target.value)} searchWords={props.searchWords} />
                     {!editing && context.token.user.isAdmin ? <Edit onClick={e => {
                        e.stopPropagation()
                        e.preventDefault()
                        setEditingState({ status: EditStatus.Editing })
                     }} /> : null}
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
                  {editing && <div className={classnames(styles.path, styles.editable)}>
                     <label onClick={() => setShowPathOptions(p => !p)}>
                        <span>Path</span>
                        <span>
                           {!showPathOptions ? <FolderClosed className={styles.folder} /> : <FolderOpen className={styles.folder} />}
                           <span>{newPath || props.book.folderPath}</span>
                        </span>
                     </label>
                     {showPathOptions && <div className={styles.pathSelection}>
                        <span>&nbsp;</span>
                        <FolderSelection directory={context.rootDirectory} selectedFolder={newPath || props.book.folderPath} folderClicked={setNewPath} addNewFolder={addNewFolder} />
                     </div>}
                  </div>}
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
            <DropdownButton title={props.book.status} id={props.book.id} onClick={e => e.stopPropagation()}>
               {
                  Object.values(Status).map(i => {
                     if (i !== props.book.status) {
                        return <Dropdown.Item key={i} onClick={e => {
                           e.preventDefault()
                           e.stopPropagation()
                           void changeBookStatus(i)
                        }}>Mark {i}</Dropdown.Item>
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

const EditableTextbox = ({ editing, searchWords, ...passThroughProps }: EditableTextboxProps) => (
   editing ? <Textbox required={true} {...passThroughProps} /> : <Highlighter searchWords={searchWords} textToHighlight={passThroughProps.defaultValue?.toString() ?? ""} sanitize={sanitize} />
)

interface EditableTextboxFieldProps extends TextboxFieldProps {
   editing: boolean,
   searchWords: string[],
}

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

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

interface FolderListProps {
   directory: Directory,
   selectedFolder: string,
   folderClicked: (folderPath: string) => void,
   className?: string,
   newFolderName: string | undefined,
   setNewFolderName: (name: string) => void,
}

interface FolderSelectionProps extends Omit<FolderListProps, "newFolderName" | "setNewFolderName"> {
   addNewFolder: (path: string, folderName: string) => Promise<void>,
}

const FolderSelection = (props: FolderSelectionProps) => {
   const [newFolderName, setNewFolderName] = useState<string | undefined>(undefined)
   const addNewFolder = async () => {
      await props.addNewFolder(props.selectedFolder, newFolderName ?? "")
      props.folderClicked(`${props.selectedFolder}${!props.selectedFolder.endsWith("/") ? "/" : ""}${newFolderName}`)
      setNewFolderName(undefined)
   }

   return (
      <div>
         <FolderList {...props} className={styles.folderList} newFolderName={newFolderName} setNewFolderName={setNewFolderName} />
         {newFolderName !== undefined ?
            <div className={styles.buttons}>
               <CancelButton className={styles.newFolderButton} onClick={() => setNewFolderName(undefined)} />
               <OkButton className={styles.newFolderButton} value="Create Folder" disabled={!newFolderName} onClick={addNewFolder} type="button" />
            </div> :
            <Button type="button" className={styles.newFolderButton} onClick={() => setNewFolderName("")}><FolderOpen className={styles.folder} /> New Folder</Button>}
      </div>
   )
}

const FolderList = ({ directory, selectedFolder, folderClicked, className, newFolderName, setNewFolderName }: FolderListProps) => {
   const open = selectedFolder.indexOf(directory.folderPath) === 0
   const subDirs = directory.items.filter(i => i.type === ItemType.directory)
   const addingFolder = open && newFolderName !== undefined && directory.folderPath === selectedFolder

   return (
      <div className={className}>
         <div className={classnames({ [styles.selected]: selectedFolder === directory.folderPath }, styles.selectableFolder)} onClick={e => {
            e.stopPropagation()
            folderClicked(directory.folderPath)
         }}>
            {open ? <FolderOpen className={styles.folder} /> : <FolderClosed className={styles.folder} />}
            {directory.name || directory.folderPath}
         </div>
         {open && (subDirs.length || addingFolder) && <div className={styles.subFolderList}>
            {addingFolder &&
               <div className={styles.newFolder}>
                  <FolderClosed className={styles.folder} />
                  <Textbox autoFocus={true} placeholder="New Folder Name" onChange={e => setNewFolderName(e.target.value)} value={newFolderName} />
               </div>}
            {subDirs.map(i => <FolderList key={i.id} directory={i as Directory} selectedFolder={selectedFolder} folderClicked={folderClicked} newFolderName={newFolderName} setNewFolderName={setNewFolderName} />)}
         </div>}
      </div>
   )
}

BookLink.displayName = "BookLink"

export default BookLink