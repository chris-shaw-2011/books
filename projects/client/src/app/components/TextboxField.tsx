import Textbox from "./Textbox"
import Field, { type FieldProps } from "./Field"

export type TextboxFieldProps = React.InputHTMLAttributes<HTMLInputElement> & FieldProps

const TextboxField = ({ label, labelLocation, ...props }: TextboxFieldProps) => (
	<Field label={label} {...(labelLocation && { labelLocation })}>
		<Textbox {...props} />
	</Field>
)

export default TextboxField
