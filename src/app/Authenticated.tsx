import React, { Fragment, useCallback, useContext, useEffect, useState } from "react"
import AccessDenied from "../shared/api/AccessDenied"
import Books from "../shared/api/Books"
import SettingsRequired from "../shared/api/SettingsRequired"
import Token from "../shared/api/Token"
import Unauthorized from "../shared/api/Unauthorized"
import Book, { Status } from "../shared/Book"
import Directory from "../shared/Directory"
import Api from "./api/LoggedInApi"
import ChangePassword from "./ChangePassword"
import EditSettings from "./EditSettings"
import Loading from "./Loading"
import AppContext, { VisibleComponent } from "./LoggedInAppContext"
import UploadBooks from "./UploadBooks"
import UserList from "./UserList"
import ItemListTabContent from "./ItemListTabContent"
import Styles from "./Authenticated.module.scss"
import classNames from "classnames"

interface Props {
   searchWords: { words: string[] },
   onPasswordChanged: (token: Token) => void,
}

interface TabState {
   selectedTab: Status,
   mountedTabs: Status[],
}

function isMatch(searchWords: string[], ...checkMatch: string[]) {
   return !searchWords.length || searchWords.every(s => checkMatch.some(m => m.indexOf(s) !== -1))
}

function filter(dir: Directory, status?: Status, searchWords?: string[]) {
   const ret = new Directory(dir)

   ret.items = []

   dir.items.forEach(i => {
      if (i instanceof Book && (!status || i.status === status)) {
         const lAuthor = i.author.toLowerCase()
         const lName = i.name.toLowerCase()
         const lComment = i.comment.toLowerCase()

         if (!searchWords || isMatch(searchWords, lAuthor, lName, lComment)) {
            ret.items.push(i)
         }
      }
      else if (i instanceof Directory) {
         let filtered: Directory

         if (!searchWords || isMatch(searchWords, i.name.toLowerCase())) {
            filtered = filter(i, status, [])
         }
         else {
            filtered = filter(i, status, searchWords)
         }

         if (filtered.items.length) {
            ret.items.push(filtered)
         }
      }
   })

   return ret
}

export default (props: Props) => {
   const [state, setState] = useState<Directory | undefined>()
   const [tabsState, setTabsState] = useState<TabState>({ selectedTab: Status.Unread, mountedTabs: [Status.Unread] })
   const context = useContext(AppContext)
   const unAuthorized = context.logOut
   const visibleComponent = context.visibleComponent
   const setVisibleComponent = context.setVisibleComponent
   const token = context.token
   const statusChanged = useCallback((books: Books) => {
      setState(books.directory)
   }, [])
   const viewBooks = () => setVisibleComponent(VisibleComponent.Books)
   const setSelectedTab = (tab: Status) => {
      setTabsState(prev => {
         return {
            selectedTab: tab,
            mountedTabs: prev.mountedTabs.includes(tab) ? prev.mountedTabs : prev.mountedTabs.concat([tab]),
         }
      })
   }

   useEffect(() => {
      async function getBooks() {
         const ret = await Api.books(token)

         if (ret instanceof Books) {
            setState(ret.directory)
         }
         else if (ret instanceof SettingsRequired) {
            setVisibleComponent(VisibleComponent.Settings)
         }
         else if (ret instanceof Unauthorized || ret instanceof AccessDenied) {
            unAuthorized(ret.message)
         }
         else {
            unAuthorized("Something unexpected happened")
         }
      }

      if (visibleComponent === VisibleComponent.Books) {
         getBooks()
      }
   }, [token, unAuthorized, visibleComponent, setVisibleComponent])

   if (!state) {
      return <Loading />
   }

   const tabsMap = Object.values(Status).map(s => {
      return { status: s, filtered: filter(state, s) }
   })

   return (
      <Fragment>
         {props.searchWords.words.length ?
            <ItemListTabContent dir={filter(state, undefined, props.searchWords.words)} searchWords={props.searchWords.words} statusChanged={statusChanged} hidden={false} /> :
            <div className={Styles.tabsContainer}>
               <div className={Styles.tabBar}>
                  {tabsMap.map(t => {
                     return <div key={`${t.status}-tab`} onClick={() => setSelectedTab(t.status)} className={classNames({ [Styles.selected]: tabsState.selectedTab === t.status })}>{t.status} ({t.filtered.bookCount()})</div>
                  })}
               </div>
               {tabsMap.filter(t => tabsState.mountedTabs.includes(t.status)).map(t => {
                  return <ItemListTabContent key={`${t.status}-content`} dir={t.filtered} status={t.status} searchWords={[]} statusChanged={statusChanged} hidden={t.status !== tabsState.selectedTab} />
               })}
            </div>
         }
         {
            (() => {
               switch (visibleComponent) {
                  case VisibleComponent.ChangePassword:
                     return <ChangePassword onPasswordChanged={(t: Token) => { props.onPasswordChanged(t); viewBooks() }} onClose={viewBooks} {...context} />
                  case VisibleComponent.Settings:
                     return <EditSettings onSettingsSaved={viewBooks} onClose={state ? viewBooks : undefined} />
                  case VisibleComponent.Users:
                     return <UserList onClose={viewBooks} />
                  case VisibleComponent.Upload:
                     return <UploadBooks onClose={viewBooks} />
                  default:
                     return null
               }
            })()
         }
      </Fragment >
   )
}