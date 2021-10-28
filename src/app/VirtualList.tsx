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

function iterate<U>(range: Range, callbackfn: (index: number) => U) {
   return [...Array<unknown>(range.max - range.min + 1)].map((_, i) => (
      callbackfn(i + range.min)
   ))
}

const VirtualList = ({ children, estimatedChildHeight, className }: Props) => {
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

         const loc = location(currentMin, Direction.Up)
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

         const loc = location(currentMax, Direction.Down)
         const renderStopPosition = (elm.current?.scrollTop ?? 0.0) + (elm.current?.getBoundingClientRect()?.height ?? 0.0) + (estimatedChildHeight * extraRowsToRender)

         if (renderStopPosition > loc.top + loc.height && change >= 0) {
            return newMaximum(maxStart, ++change)
         }
         else if (renderStopPosition < loc.top && change <= 0) {
            return newMaximum(maxStart, --change)
         }

         return currentMax
      }
      const location = (index: number, direction: Direction): { top: number, height: number } => {
         const ref = childRefs.current[index]

         if (ref || index === 0) {
            return { top: ref?.offsetTop ?? 0, height: ref?.getBoundingClientRect()?.height ?? estimatedChildHeight }
         }
         else if (direction === Direction.Up) {
            return { top: index * estimatedChildHeight, height: estimatedChildHeight }
         }
         else {
            const loc = location(index - 1, direction)

            return { top: loc.top + loc.height + 1, height: estimatedChildHeight }
         }
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

   return (
      <div className={classNames(Styles.virtualList, className)} ref={elm}>
         <div style={{ height: estimatedChildHeight * renderedRange.min + "px" }} />
         {children.length > 0 && iterate(renderedRange, i => children[i] ? cloneElement(children[i], { ref: (el: HTMLDivElement | null) => childRefs.current[i] = el }) : undefined)}
         <div style={{ height: estimatedChildHeight * (children.length - 1 - renderedRange.max) + "px" }} />
      </div>
   )
}

export default VirtualList