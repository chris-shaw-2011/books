import styles from "./Loading.module.scss"

interface Props {
	text?: string | undefined,
}

const Loading = ({ text }: Props) => (
	<div className={styles.loading}>
		<div>
			<div className={styles.spinner} role="status" aria-label={text ?? "Loading"} />
			<div>{text ?? "Loading..."}</div>
		</div>
	</div>
)

export default Loading
