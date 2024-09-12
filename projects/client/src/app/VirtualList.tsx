import { cloneElement, useState, useRef, useEffect, useCallback } from "react"
import useResizeObserver from "use-resize-observer/polyfilled"
import Styles from "./VirtualList.module.scss"
import classNames from "classnames"

const extraRowsToRender = 2

interface Props {
	estimatedChildHeight: number,
	children: React.ReactElement[],
	className?: string,
}

enum Direction {
	Up,
	Down,
}

interface Range {
	min: number
	max: number
}

const location = (index: number, direction: Direction, estimatedChildHeight: number, childRefs: React.MutableRefObject<(HTMLDivElement | null)[]>): { top: number, height: number } => {
	const ref = childRefs.current[index]

	if (ref || index === 0) {
		return { top: ref?.offsetTop ?? 0, height: ref?.getBoundingClientRect().height ?? estimatedChildHeight }
	}
	else if (direction === Direction.Up) {
		return { top: index * estimatedChildHeight, height: estimatedChildHeight }
	}
	else {
		const loc = location(index - 1, direction, estimatedChildHeight, childRefs)

		return { top: loc.top + loc.height + 1, height: estimatedChildHeight }
	}
}

const VirtualList = ({ children, estimatedChildHeight, className }: Props) => {
	const alwaysRenderKeys = useRef(new Array<(string | number)>(children.length))
	const [renderedRange, setRenderedRange] = useState<Range>({ min: 0, max: 0 })
	const elm = useRef<HTMLDivElement>(null)
	const childRefs = useRef(new Array<HTMLDivElement | null>(children.length))
	const updateRenderedComponents = useCallback(() => {
		const newMinimum = (minStart: number, change: number): number => {
			const currentMin = minStart + change

			if (currentMin < 0) {
				return 0
			}
			else if (currentMin >= children.length) {
				return children.length - 1
			}

			const loc = location(currentMin, Direction.Up, estimatedChildHeight, childRefs)
			const renderStartPosition = (elm.current?.scrollTop ?? 0) - (estimatedChildHeight * extraRowsToRender)

			if (renderStartPosition <= 0) {
				return 0
			}
			else if (renderStartPosition > loc.top + loc.height && change >= 0) {
				return newMinimum(minStart, ++change)
			}
			else if (renderStartPosition < loc.top && change <= 0) {
				return newMinimum(minStart, --change)
			}

			return currentMin
		}
		//We need the change variable to make sure we don't get stuck in a loop flipping between two indexes because the measurements are inprecise, the idea is once the change variable has went positive or negative it can't go the other direction
		const newMaximum = (maxStart: number, change: number): number => {
			const currentMax = maxStart + change

			if (currentMax >= children.length) {
				return children.length - 1
			}
			else if (currentMax < 0) {
				return 0
			}

			const loc = location(currentMax, Direction.Down, estimatedChildHeight, childRefs)
			const renderStopPosition = (elm.current?.scrollTop ?? 0.0) + (elm.current?.getBoundingClientRect().height ?? 0.0) + (estimatedChildHeight * extraRowsToRender)

			if (renderStopPosition > loc.top + loc.height && change >= 0) {
				return newMaximum(maxStart, ++change)
			}
			else if (renderStopPosition < loc.top && change <= 0) {
				return newMaximum(maxStart, --change)
			}

			return currentMax
		}

		setRenderedRange(prev => {
			return { min: newMinimum(prev.min, 0), max: newMaximum(prev.max, 0) }
		})
	}, [children, estimatedChildHeight, elm, setRenderedRange])
	const scrolled = useCallback(() => {
		updateRenderedComponents()
	}, [elm, estimatedChildHeight, updateRenderedComponents])

	useResizeObserver({
		onResize: updateRenderedComponents,
		ref: elm,
	})

	useEffect(() => {
		const currentElm = elm.current
		currentElm?.addEventListener("scroll", scrolled)

		scrolled()

		return () => {
			currentElm?.removeEventListener("scroll", scrolled)
		}
	}, [elm, scrolled])
	const willBeRendered = (index: number, range: Range) => {
		return (index >= range.min && index <= range.max) || alwaysRenderKeys.current.includes(children[index].key ?? "")
	}
	const toggleAlwaysRender = (key: (string | number)) => {
		const index = alwaysRenderKeys.current.indexOf(key)

		if (index === -1) {
			alwaysRenderKeys.current.push(key)
		}
		else {
			alwaysRenderKeys.current.splice(index, 1)
		}
	}

	let rowCount = 0

	return (
		<div className={classNames(Styles.virtualList, className)} ref={elm}>
			{children.map((child, index, arr) => {
				if (willBeRendered(index, renderedRange)) {
					return cloneElement(child, { toggleAlwaysRender: toggleAlwaysRender, ref: (el: HTMLDivElement | null) => childRefs.current[index] = el })
				}
				else if (arr.length === index + 1 || willBeRendered(index + 1, renderedRange)) {
					const height = estimatedChildHeight * (rowCount + 1)
					rowCount = 0
					return <div key={index} style={{ height: `${height}px` }} />
				}
				else {
					++rowCount
					return null
				}
			})}
		</div>
	)
}

export default VirtualList