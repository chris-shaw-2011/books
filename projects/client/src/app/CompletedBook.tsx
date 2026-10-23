import { use } from "react"
import type { Book } from "@books/shared"
import LoggedInAppContext from "./context/LoggedInAppContext"
import BookLink from "./BookLink"
import Button from "./components/Button"

interface Props {
	book: Book,
	onComplete: () => void,
}

const CompletedBook = ({ book, onComplete }: Props) => {
	const { token } = use(LoggedInAppContext)

	return (
		<div>
			<p>Imported successfully.</p>
			<BookLink book={book} editOnly={token.user.isAdmin} onEditComplete={onComplete} />
			{!token.user.isAdmin && <Button onClick={onComplete}>Done</Button>}
		</div>
	)
}

export default CompletedBook
