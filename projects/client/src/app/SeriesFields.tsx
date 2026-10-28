import TextboxField from "./components/TextboxField"
import SelectField from "./components/SelectField"

interface Props {
	name: string,
	order: number | undefined,
	onNameChange: (name: string) => void,
	onOrderChange: React.ChangeEventHandler<HTMLInputElement>,
	options?: { value: string, label: string }[],
	required?: boolean,
	disabled?: boolean,
}

const SeriesFields = ({ name, order, onNameChange, onOrderChange, options, required = false, disabled = false }: Props) => (
	<>
		{options ?
				(
					<SelectField label="Series" labelLocation="Left" value={name} disabled={disabled} onChange={event => onNameChange(event.target.value)}>
						{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
					</SelectField>
				) :
				<TextboxField label="Series" labelLocation="Left" value={name} disabled={disabled} onChange={event => onNameChange(event.target.value)} />}
		{name && <TextboxField label="Reading order" labelLocation="Left" value={order ?? ""} type="number" min={0} step="any" required={required} disabled={disabled} onChange={onOrderChange} />}
	</>
)

export default SeriesFields
