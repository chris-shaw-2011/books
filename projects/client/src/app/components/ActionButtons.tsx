import Loading from "../Loading"
import styles from "./ActionButtons.module.scss"
import CancelButton from "./CancelButton"
import DeleteButton from "./DeleteButton"
import OkButton from "./OkButton"
import classNames from "classnames"

type ActionButtonType = "OkButton" | "DeleteButton"

interface ActionButtonsProps {
	cancelButtonClassName?: string,
	onCancelClick: () => void,
	actionButtonText: string,
	actionButtonType?: ActionButtonType,
	actionButtonOnClick?: () => void,
	actionButtonClassName?: string,
	changeHappening?: boolean,
	changeHappeningText?: string,
	actionButtonDisabled?: boolean,
	className?: string,
}

const ActionButtons = ({ onCancelClick, actionButtonText, actionButtonOnClick, actionButtonType, changeHappening, changeHappeningText, cancelButtonClassName, actionButtonClassName, actionButtonDisabled, className }: ActionButtonsProps) => {
	let actionButton

	if (changeHappening) {
		return <Loading text={changeHappeningText} />
	}

	if (actionButtonType === "DeleteButton") {
		actionButton = <DeleteButton value={actionButtonText} onClick={actionButtonOnClick} className={actionButtonClassName} disabled={actionButtonDisabled} />
	}
	else {
		actionButton = <OkButton value={actionButtonText} onClick={actionButtonOnClick} className={actionButtonClassName} disabled={actionButtonDisabled} />
	}

	return (
		<div className={classNames(styles.actionButtons, className)}>
			{actionButton}
			<CancelButton onClick={onCancelClick} className={cancelButtonClassName} />
		</div>
	)
}

export default ActionButtons