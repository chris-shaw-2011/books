import { use } from "react"
import Highlighter from "react-highlight-words"
import AppContext from "./context/AppContext"

const sanitize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const Highlight = ({ text }: { text: string }) => {
	const { searchWords } = use(AppContext)
	return <Highlighter searchWords={[...searchWords]} textToHighlight={text} sanitize={sanitize} />
}

export default Highlight
