import { Spinner } from "react-bootstrap"
import styles from "./Loading.module.scss"

interface Props {
	text?: string | undefined,
}

const Loading = ({ text }: Props) => (
	<div className={styles.loading}>
		<div>
			<Spinner animation="border" role="status" />
			<div>{text ?? "Loading..."}</div>
		</div>
	</div>
)

export default Loading
