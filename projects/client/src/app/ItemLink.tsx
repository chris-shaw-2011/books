import { forwardRef } from "react"
import { Directory, Book, Books } from "@books/shared"
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

const ItemLink = forwardRef<HTMLDivElement, ItemLinkProps>((props, ref) => (
	props.item.type === "Book" ?
		<BookLink book={props.item} {...props} ref={ref} className={classNames(props.className, styles.item)} /> :
		<DirectoryLink directory={props.item} {...props} ref={ref} className={classNames(props.className, styles.item)} />
))

ItemLink.displayName = "ItemLink"

export default ItemLink