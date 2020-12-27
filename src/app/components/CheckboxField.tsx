import styles from "./CheckboxField.module.scss"

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
   label: string,
}

const CheckboxField = (props: Props) => (
   <label className={styles.checkbox}>
      <input {...props} />
      {props.label}
   </label>
)

export default CheckboxField