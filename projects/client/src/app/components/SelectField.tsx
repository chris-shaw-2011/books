import classnames from "classnames"
import Field, { type FieldProps } from "./Field"
import styles from "./SelectField.module.scss"

const SelectField = ({ label, labelLocation, ...props }: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) => (
	<Field label={label} {...(labelLocation && { labelLocation })}>
		<select {...props} className={classnames(styles.select, props.className)} />
	</Field>
)

export default SelectField
