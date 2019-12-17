import React, { useEffect, useState, useContext, useCallback } from "react"
import { Tabs, Tab } from "react-bootstrap"
import Directory from "../shared/Directory"
import Book, { Status } from "../shared/Book";
import Loading from "./Loading"
import ItemList from "./ItemList";
import Api from "./Api";
import Unauthorized from "../shared/api/Unauthorized";
import AccessDenied from "../shared/api/AccessDenied";
import Books from "../shared/api/Books";
import SettingsRequired from "../shared/api/SettingsRequired";
import EditSettings from "./EditSettings"
import AppContext, { VisibleComponent } from "./LoggedInAppContext";
import UserList from "./UserList";
import ChangePassword from "./ChangePassword";
import Token from "../shared/api/Token";

interface Props {
   searchWords: Array<string>,
   onPasswordChanged: (token: Token) => void,
}

function filter(dir: Directory, status: Status, searchWords: string[]) {
   var ret = new Directory(dir)

   ret.items = []

   dir.items.forEach(i => {
      if (i instanceof Book && i.status === status) {
         var lAuthor = i.author.toLowerCase();
         var lName = i.name.toLowerCase();
         var lComment = i.comment.toLowerCase();

         if (!searchWords.length || searchWords.every(s => lAuthor.indexOf(s) !== -1 || lName.indexOf(s) !== -1 || lComment.indexOf(s) !== -1)) {
            ret.items.push(i)
         }
      }
      else if (i instanceof Directory) {
         var rec = filter(i, status, searchWords);

         if (rec.items.length) {
            ret.items.push(rec)
         }
      }
   })

   return ret;
}

const Authenticated: React.FC<Props> = (props: Props) => {
   const [state, setState] = useState<Directory | undefined>()
   const context = useContext(AppContext)
   const unAuthorized = context.logOut
   const visibleComponent = context.visibleComponent
   const setVisibleComponent = context.setVisibleComponent
   const token = context.token
   const statusChanged = useCallback((books: Books) => {
      setState(books.directory)
   }, [])

   useEffect(() => {
      async function getBooks() {
         var ret = await Api.books(token)

         if (ret instanceof Books) {
            setState(ret.directory)
         }
         else if (ret instanceof SettingsRequired) {
            setVisibleComponent(VisibleComponent.Settings)
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            unAuthorized(ret.message);
         }
         else {
            unAuthorized("Something unexpected happened")
         }
      }

      if (visibleComponent === VisibleComponent.Books) {
         getBooks()
      }
   }, [token, unAuthorized, visibleComponent, setVisibleComponent])

   if (visibleComponent === VisibleComponent.Settings) {
      return <EditSettings onSettingsSaved={() => { setVisibleComponent(VisibleComponent.Books) }} {...props} />
   }
   else if (visibleComponent === VisibleComponent.Users) {
      return <UserList onClose={() => { setVisibleComponent(VisibleComponent.Books) }} />
   }
   else if (visibleComponent === VisibleComponent.ChangePassword) {
      return <ChangePassword onPasswordChanged={(token: Token) => { props.onPasswordChanged(token); setVisibleComponent(VisibleComponent.Books) }} logOut={context.logOut} token={context.token} onCancel={() => setVisibleComponent(VisibleComponent.Books)} />
   }
   else if (state instanceof Directory) {
      var unreadBooks = filter(state, Status.Unread, props.searchWords);
      var readBooks = filter(state, Status.Read, props.searchWords);

      return (
         <Tabs defaultActiveKey="unread" id="main-tab">
            <Tab eventKey="unread" title={`Unread (${unreadBooks.bookCount()})`} mountOnEnter={true}>
               <ItemList items={unreadBooks.items} className="rootItemList" searchWords={props.searchWords} statusChanged={statusChanged} />
            </Tab>
            <Tab eventKey="read" title={`Read (${readBooks.bookCount()})`} mountOnEnter={true}>
               <ItemList items={readBooks.items} className="rootItemList" searchWords={props.searchWords} statusChanged={statusChanged} />
            </Tab>
         </Tabs>
      )
   }
   else {
      return (
         <Loading />
      )
   }
}

export default Authenticated