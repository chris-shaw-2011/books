import { Directory, Book } from "@books/shared"
import BookLink from "./BookLink"
import DirectoryLink from "./DirectoryLink"
import styles from "./ItemLink.module.scss"
import classNames from "classnames"

interface ItemLinkProps {
	item: Directory | Book,
	style?: React.CSSProperties | undefined,
	className?: string | undefined,
}

const ItemLink = (props: ItemLinkProps) => {
	if (props.item.type === "Book") {
		return <BookLink book={props.item} className={classNames(props.className, styles.item)} style={props.style} />
	}
	else {
		return <DirectoryLink directory={props.item} className={classNames(props.className, styles.item)} style={props.style} />
	}
}

ItemLink.displayName = "ItemLink"

export default ItemLink