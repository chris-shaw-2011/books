import { lazy, Suspense, useContext, useEffect, useState } from "react"
import { Token, Book, type Status, Directory, StatusValues } from "@books/shared"
import Api from "./api/LoggedInApi"
import ChangePassword from "./ChangePassword"
import Loading from "./Loading"
import LoggedInAppContext from "./context/LoggedInAppContext"
import UploadBooks from "./UploadBooks"
import ItemListTabContent from "./ItemListTabContent"
import Styles from "./Authenticated.module.scss"
import classNames from "classnames"
import AppContext, { handleDynamicImportFailure } from "./context/AppContext"

const EditSettings = lazy(() => import("./EditSettings").catch(handleDynamicImportFailure))
const UserList = lazy(() => import("./UserList").catch(handleDynamicImportFailure))

interface Props {
	token: Token,
}

function isMatch(searchWords: readonly string[], ...checkMatch: string[]) {
	return !searchWords.length || searchWords.every(s => checkMatch.some(m => m.includes(s)))
}

function filter(dir: Directory, status?: Status, searchWords?: readonly string[]) {
	const ret = new Directory(dir)
	const items = dir.items

	ret.items = []

	items.forEach(i => {
		if (i instanceof Book) {
			if (!status || i.status === status) {
				const lAuthor = i.author.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
				const lName = i.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
				const lComment = i.comment.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
				const lNarrator = i.narrator.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
				const lGenre = i.genre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

				if (!searchWords || isMatch(searchWords, lAuthor, lName, lComment, lNarrator, lGenre)) {
					ret.items.push(i)
				}
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
		else {
			throw Error("Unexpected instance of item")
		}
	})

	return ret
}

interface ItemListTabsProps {
	items: Directory,
}

const ItemListTabs = ({ items }: ItemListTabsProps) => {
	const appContext = useContext(AppContext)
	const [selectedTab, setSelectedTab] = useState<Status>("Unread")

	if (appContext.searchWords.length) {
		return <ItemListTabContent dir={filter(items, undefined, appContext.searchWords)} />
	}
	else {
		const tabsMap = new Map<Status, Directory>(StatusValues.map(s =>
			[s, filter(items, s)],
		))
		const selectedTabData = tabsMap.get(selectedTab)

		if (!selectedTabData) {
			throw Error("SelectedTabData was null for some reason")
		}

		return (
			<div className={Styles.tabsContainer}>
				<div className={Styles.tabBar}>
					{Array.from(tabsMap).map(m => {
						const k = m[0]
						const value = m[1]

						return (
							<div key={`${k}-tab`} onClick={() => setSelectedTab(k)} className={classNames({ [Styles.selected]: selectedTab === k })}>
								{k}
								{" "}
								(
								{value.bookCount()}
								)
							</div>
						)
					})}
				</div>
				<ItemListTabContent key={`${selectedTab}-content`} dir={selectedTabData} status={selectedTab} />
			</div>
		)
	}
}

const Authenticated = ({ token }: Props) => {
	const { logOut, visibleComponent, setVisibleComponent } = useContext(AppContext)
	const [state, setState] = useState<Directory | undefined>()
	const viewBooks = () => setVisibleComponent("Books")

	// TODO: figure out why this is called twice
	useEffect(() => {
		async function getBooks() {
			const ret = await Api.books(logOut)

			setState(ret.directory)

			if (ret.missingSettings) {
				setVisibleComponent("Settings")
			}
		}

		if (visibleComponent === "Books") {
			void getBooks()
		}
	}, [token, logOut, visibleComponent, setVisibleComponent])

	if (!state) {
		return <Loading />
	}

	return (
		<LoggedInAppContext.Provider value={{ token, updateBooks: setState, rootDirectory: state }}>
			<ItemListTabs items={state} />
			{
				(() => {
					switch (visibleComponent) {
						case "ChangePassword":
							return <ChangePassword onClose={viewBooks} />
						case "Settings":
							return (
								<Suspense fallback={<Loading />}>
									<EditSettings onSettingsSaved={viewBooks} onClose={viewBooks} />
								</Suspense>
							)
						case "Users":
							return (
								<Suspense fallback={<Loading />}>
									<UserList onClose={viewBooks} />
								</Suspense>
							)
						case "Upload":
							return <UploadBooks onClose={viewBooks} />
						default:
							return null
					}
				})()
			}
		</LoggedInAppContext.Provider>
	)
}

export default Authenticated