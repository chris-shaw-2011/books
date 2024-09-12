import { type ReactNode, useState } from "react"
import styles from "./SelectList.module.scss"
import classnames from "classnames"
import AnimateHeight, { type Height } from "react-animate-height"

interface Props {
	className?: string,
	children: ReactNode,
	open: boolean,
}

const SelectList = (props: Props) => {
	const [hidden, setHidden] = useState(!props.open ? styles.hidden : "")
	const onHeightAnimationEnd = (newHeight: Height) => {
		if (newHeight) {
			setHidden("")
		}
		else {
			setHidden(styles.hidden)
		}
	}

	return (
		<AnimateHeight duration={250} height={props.open ? "auto" : 0} className={classnames(styles.selectList, props.className, hidden)} onHeightAnimationEnd={onHeightAnimationEnd}>
			{props.children}
		</AnimateHeight>
	)
}

export const SelectListItem = (props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
	<div {...props} className={classnames(styles.item, props.className)}>
		{props.children}
	</div>
)

export default SelectList