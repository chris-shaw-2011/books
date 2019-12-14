import React, { useEffect, useState, useContext } from "react"
import { Tabs, Tab } from "react-bootstrap"
import Directory from "../shared/Directory"
import { Status } from "../shared/Book";
import Loading from "./Loading"
import { ItemType } from "../shared/ItemType";
import ItemList from "./ItemList";
import Api from "./Api";
import Unauthorized from "../shared/api/Unauthorized";
import AccessDenied from "../shared/api/AccessDenied";
import Books from "../shared/api/Books";
import SettingsRequired from "../shared/api/SettingsRequired";
import EditSettings from "./EditSettings"
import AppContext from "./LoggedInAppContext";

interface Props {
   searchWords: Array<string>,
   goToSettings: boolean,
   clearGoToSettings: () => void,
}

function filter(dir: Directory, status: Status, searchWords: string[]) {
   var ret = new Directory()

   ret.name = dir.name

   dir.items.forEach(i => {
      if (i.type === ItemType.book && i.status === status) {
         var lAuthor = i.author.toLowerCase();
         var lName = i.name.toLowerCase();
         var lComment = i.comment.toLowerCase();

         if (!searchWords.length || searchWords.every(s => lAuthor.indexOf(s) !== -1 || lName.indexOf(s) !== -1 || lComment.indexOf(s) !== -1)) {
            ret.items.push(i)
         }
      }
      else if (i.type === ItemType.directory) {
         var rec = filter(i as Directory, status, searchWords);

         if (rec.items.length) {
            ret.items.push(rec)
         }
      }
   })

   return ret;
}

const Authenticated: React.FC<Props> = (props: Props) => {
   const [state, setState] = useState<Directory | SettingsRequired | undefined>()
   const [getBooksFromApi, setGetBooksFromApi] = useState()
   const [, forceUpdate] = useState()
   const context = useContext(AppContext)
   const unAuthorized = context.logOut
   const goToSettings = props.goToSettings
   const token = context.token

   useEffect(() => {
      async function getBooks() {
         var ret = await Api.books(token)

         if (ret instanceof Books) {
            setState(ret.directory)
         }
         else if (ret instanceof SettingsRequired) {
            setState(ret)
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            unAuthorized(ret.message);
         }
         else {
            unAuthorized("Something unexpected happened")
         }
      }

      if (!goToSettings) {
         getBooks()
      }
   }, [getBooksFromApi, token, unAuthorized, goToSettings])

   if (props.goToSettings) {
      return <EditSettings onSettingsSaved={() => { setGetBooksFromApi({}); props.clearGoToSettings() }} {...props} />
   }
   else if (state instanceof Directory) {
      var unreadBooks = filter(state, Status.Unread, props.searchWords);
      var readBooks = filter(state, Status.Read, props.searchWords);

      return (
         <Tabs defaultActiveKey="unread" id="main-tab">
            <Tab eventKey="unread" title={`Unread (${unreadBooks.bookCount()})`} >
               <ItemList items={unreadBooks.items} className="rootItemList" searchWords={props.searchWords} statusChanged={() => forceUpdate({})} />
            </Tab>
            <Tab eventKey="read" title={`Read (${readBooks.bookCount()})`} >
               <ItemList items={readBooks.items} className="rootItemList" searchWords={props.searchWords} statusChanged={() => forceUpdate({})} />
            </Tab>
         </Tabs>
      )
   }
   else if (state instanceof SettingsRequired) {
      return <EditSettings settings={state.settings} message={state.message} onSettingsSaved={() => setGetBooksFromApi({})} {...props} />
   }
   else {
      return (
         <Loading />
      )
   }
}

export default Authenticated