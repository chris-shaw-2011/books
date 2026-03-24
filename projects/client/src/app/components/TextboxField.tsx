import Textbox from "./Textbox"
import styles from "./TextboxField.module.scss"
import classnames from "classnames"

type LabelLocation = "Top" | "Left"

export interface TextboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string,
	labelLocation?: LabelLocation,
}

const Label = (props: TextboxFieldProps) => {
	if (props.labelLocation === "Left") {
		return <span>{props.label}</span>
	}
	else {
		return <div>{props.label}</div>
	}
}

const TextboxField = (props: TextboxFieldProps) => {
	const { labelLocation, ...passThroughProps } = props

	return (
		<label className={classnames(styles.textboxField, { [styles.labelLeft]: labelLocation === "Left" })}>
			<Label {...props} />
			<Textbox {...passThroughProps} />
		</label>
	)
}

export default TextboxField
