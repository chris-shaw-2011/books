import styles from "./OverlayComponent.module.scss"
import classnames from "classnames"

const OverlayComponent = (props: React.HTMLAttributes<HTMLDivElement>) => {
	const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (props.onClick && e.target === e.currentTarget) {
			props.onClick(e)
		}
	}

	return (
		<div {...props} className={classnames(styles.overlay, props.className)} onClick={onClick}>
			<div>
				{props.children}
			</div>
		</div>
	)
}

export default OverlayComponent