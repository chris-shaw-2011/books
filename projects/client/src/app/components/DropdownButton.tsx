import { type KeyboardEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import useOnclickOutside from "react-cool-onclickoutside"
import classnames from "classnames"
import styles from "./DropdownButton.module.scss"

interface DropdownOption<T extends string> {
	label: ReactNode,
	value: T,
}

interface Props<T extends string> {
	id: string,
	title: ReactNode,
	options: readonly DropdownOption<T>[],
	onSelect: (value: T, event: MouseEvent<HTMLButtonElement>) => void,
	onClick?: (event: MouseEvent<HTMLDivElement>) => void,
	variant?: "primary" | "secondary",
}

interface Placement {
	above: boolean,
	offsetX: number,
	offsetY: number,
}

const DropdownButton = <T extends string>({ id, title, options, onSelect, onClick, variant = "primary" }: Props<T>) => {
	const [open, setOpen] = useState(false)
	const [placement, setPlacement] = useState<Placement>({ above: false, offsetX: 0, offsetY: 0 })
	const toggleRef = useRef<HTMLButtonElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
	const pendingFocus = useRef<number | null>(null)
	const rootRef = useOnclickOutside(() => setOpen(false), { disabled: !open })
	const menuId = `${id}-menu`

	const focusItem = useCallback((index: number) => {
		const items = itemRefs.current.filter(item => item !== null)
		const item = items[(index + items.length) % items.length]

		item?.focus()
	}, [])
	const openAndFocus = (index: number) => {
		pendingFocus.current = index
		setOpen(true)
	}
	const closeAndFocusToggle = () => {
		setOpen(false)
		toggleRef.current?.focus()
	}
	const updatePlacement = useCallback(() => {
		const toggle = toggleRef.current
		const menu = menuRef.current

		if (!toggle || !menu) {
			return
		}

		const toggleRect = toggle.getBoundingClientRect()
		const menuRect = menu.getBoundingClientRect()
		const viewportPadding = 4
		const spaceBelow = window.innerHeight - toggleRect.bottom
		const above = menuRect.height > spaceBelow && toggleRect.top > spaceBelow
		const naturalLeft = toggleRect.left
		const naturalRight = naturalLeft + menuRect.width
		const naturalTop = above ? toggleRect.top - 2 - menuRect.height : toggleRect.bottom + 2
		const naturalBottom = naturalTop + menuRect.height
		let offsetX = 0
		let offsetY = 0

		if (naturalRight > window.innerWidth - viewportPadding) {
			offsetX = window.innerWidth - viewportPadding - naturalRight
		}
		if (naturalLeft + offsetX < viewportPadding) {
			offsetX += viewportPadding - (naturalLeft + offsetX)
		}
		if (naturalBottom > window.innerHeight - viewportPadding) {
			offsetY = window.innerHeight - viewportPadding - naturalBottom
		}
		if (naturalTop + offsetY < viewportPadding) {
			offsetY += viewportPadding - (naturalTop + offsetY)
		}

		setPlacement({ above, offsetX, offsetY })
	}, [])

	useLayoutEffect(() => {
		if (open) {
			updatePlacement()

			if (pendingFocus.current !== null) {
				focusItem(pendingFocus.current)
				pendingFocus.current = null
			}
		}
	}, [focusItem, open, updatePlacement])

	useEffect(() => {
		if (!open) {
			return
		}

		window.addEventListener("resize", updatePlacement)
		document.addEventListener("scroll", updatePlacement, true)

		return () => {
			window.removeEventListener("resize", updatePlacement)
			document.removeEventListener("scroll", updatePlacement, true)
		}
	}, [open, updatePlacement])

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const items = itemRefs.current.filter(item => item !== null)
		const activeIndex = items.findIndex(item => item === document.activeElement)

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				if (open) {
					focusItem(activeIndex + 1)
				}
				else {
					openAndFocus(0)
				}
				break
			case "ArrowUp":
				event.preventDefault()
				if (open) {
					focusItem(activeIndex < 0 ? -1 : activeIndex - 1)
				}
				else {
					openAndFocus(-1)
				}
				break
			case "Home":
				if (open) {
					event.preventDefault()
					focusItem(0)
				}
				break
			case "End":
				if (open) {
					event.preventDefault()
					focusItem(-1)
				}
				break
			case "Escape":
				if (open) {
					event.preventDefault()
					closeAndFocusToggle()
				}
				break
			case "Tab":
				setOpen(false)
				break
		}
	}

	return (
		<div className={styles.dropdown} onClick={onClick} onKeyDown={onKeyDown} ref={rootRef}>
			<button
				aria-controls={open ? menuId : undefined}
				aria-expanded={open}
				aria-haspopup="menu"
				className={classnames(styles.toggle, styles[variant])}
				id={id}
				onClick={() => setOpen(value => !value)}
				ref={toggleRef}
				type="button"
			>
				{title}
			</button>
			{open && (
				<div
					aria-labelledby={id}
					className={classnames(styles.menu, { [styles.above]: placement.above })}
					id={menuId}
					ref={menuRef}
					role="menu"
					style={{ transform: `translate(${placement.offsetX}px, ${placement.offsetY}px)` }}
				>
					{options.map((option, index) => (
						<button
							className={styles.item}
							key={option.value}
							onClick={event => {
								onSelect(option.value, event)
								closeAndFocusToggle()
							}}
							ref={element => { itemRefs.current[index] = element }}
							role="menuitem"
							tabIndex={-1}
							type="button"
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export default DropdownButton
