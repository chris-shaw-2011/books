import classnames from "classnames"
import styles from "./Field.module.scss"

export interface FieldProps {
	label: string,
	labelLocation?: "Top" | "Left",
}

const Field = ({ label, labelLocation, children }: FieldProps & { children: React.ReactNode }) => (
	<label className={classnames(styles.field, { [styles.labelLeft]: labelLocation === "Left" })}>
		{labelLocation === "Left" ? <span>{label}</span> : <div>{label}</div>}
		{children}
	</label>
)

export default Field
