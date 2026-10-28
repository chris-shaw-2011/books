import styles from "./CheckboxField.module.scss"

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string,
	indeterminate?: boolean,
}

const CheckboxField = ({ label, indeterminate = false, ...props }: Props) => (
	<label className={styles.checkbox}>
		<input type="checkbox" {...props} ref={input => { if (input) input.indeterminate = indeterminate }} />
		{label}
	</label>
)

export default CheckboxField
