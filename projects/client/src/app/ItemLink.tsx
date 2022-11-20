import { forwardRef } from "react"
import { Directory, Book, ItemType, Books } from "@books/shared"
import BookLink from "./BookLink"
import DirectoryLink from "./DirectoryLink"
import styles from "./ItemLink.module.scss"
import classNames from "classnames"

interface ItemLinkProps {
	item: Directory | Book,
	style?: React.CSSProperties,
	className?: string,
	searchWords: string[],
	statusChanged: (books: Books) => void,
	toggleAlwaysRender?: (key: (string | number)) => void
}

const ItemLink = forwardRef<HTMLDivElement, ItemLinkProps>(({ item, className, searchWords, statusChanged, style, toggleAlwaysRender }: ItemLinkProps, ref) => (
	item.type === ItemType.book ?
		<BookLink book={item} className={classNames(className, styles.item)} searchWords={searchWords} statusChanged={statusChanged} style={style} ref={ref} /> :
		<DirectoryLink directory={item} className={classNames(className, styles.item)} searchWords={searchWords} statusChanged={statusChanged} style={style} ref={ref} toggleAlwaysRender={toggleAlwaysRender} />
))

ItemLink.displayName = "ItemLink"

export default ItemLink