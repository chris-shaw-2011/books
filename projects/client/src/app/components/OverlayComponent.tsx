import styles from "./OverlayComponent.module.scss"
import classnames from "classnames"

const OverlayComponent = ({ wide = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) => {
	const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (props.onClick && e.target === e.currentTarget) {
			props.onClick(e)
		}
	}

	return (
		<div {...props} className={classnames(styles.overlay, { [styles.wide]: wide }, props.className)} onClick={onClick}>
			<div>
				{props.children}
			</div>
		</div>
	)
}

export default OverlayComponent
