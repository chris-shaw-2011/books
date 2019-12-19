import React, { useEffect, useState, useContext, useCallback, Fragment } from "react"
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
   searchWords: { typing: boolean, words: Array<string> },
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
   const viewBooks = () => setVisibleComponent(VisibleComponent.Books)

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

   if (props.searchWords.typing) {
      return <Loading text="Searching..." />
   }

   return (
      <Fragment>
         {state ? <Tabs defaultActiveKey={Status.Unread} id="main-tab">
            {(() => {
               var map = new Map<Status, Directory>()
               Object.values(Status).forEach(s => map.set(s, filter(state, s, props.searchWords.words)))

               return Object.values(Status).map(s => {
                  const items = map.get(s)!

                  return (
                     <Tab eventKey={s} title={`${s} (${items.bookCount()})`} mountOnEnter={true} key={s}>
                        <ItemList items={items.items} className="rootItemList" searchWords={props.searchWords.words} statusChanged={statusChanged} />
                     </Tab>)
               })
            })()}
         </Tabs> : <Loading />}
         {(() => {
            switch (visibleComponent) {
               case VisibleComponent.ChangePassword:
                  return <ChangePassword onPasswordChanged={(token: Token) => { props.onPasswordChanged(token); viewBooks() }} onClose={viewBooks} {...context} />
               case VisibleComponent.Settings:
                  return <EditSettings onSettingsSaved={viewBooks} onClose={state ? viewBooks : undefined} />
               case VisibleComponent.Users:
                  return <UserList onClose={viewBooks} />
               default:
                  return null;
            }
         })()}
      </Fragment>
   )
}

export default Authenticated