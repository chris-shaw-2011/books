import React, { useState, useRef, useEffect, useCallback } from "react"
import useResizeObserver from "use-resize-observer/polyfilled"
import Styles from "./VirtualList.module.scss"
import classNames from "classnames"

interface Props<T> {
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
   return [...Array<object>(range.max - range.min + 1)].map((_, i) => (
      callbackfn(i + range.min)
   ))
}

export default function VirtualList<T>({ children, estimatedChildHeight, className }: Props<T>) {
   const [renderedRange, setRenderedRange] = useState<Range>({ min: 0, max: 0 })
   const elm = useRef<HTMLDivElement>(null)
   const childRefs = useRef(new Array<HTMLDivElement | null>(children.length))
   const lastUpdateOffset = useRef(estimatedChildHeight * -1)
   const updateRenderedComponents = React.useCallback(() => {
      const newMinimum = (currentMin: number): number => {
         if (currentMin < 0) {
            return 0
         }
         else if (currentMin >= children.length) {
            return children.length - 1
         }

         const loc = location(currentMin, Direction.Up)
         const desiredTop = elm.current!.scrollTop - (estimatedChildHeight * 2)

         if (desiredTop <= 0) {
            return 0
         }
         else if (desiredTop > loc.top + loc.height) {
            return newMinimum(currentMin + 1)
         }
         else if (desiredTop < loc.top) {
            return newMinimum(currentMin - 1)
         }

         return currentMin
      }
      const newMaximum = (currentMax: number): number => {
         if (currentMax >= children.length) {
            return children.length - 1
         }
         else if (currentMax < 0) {
            return 0
         }

         const loc = location(currentMax, Direction.Down)
         const desiredTop = elm.current!.scrollTop + elm.current!.offsetHeight + (estimatedChildHeight * 2)

         if (desiredTop > loc.top + loc.height) {
            return newMaximum(currentMax + 1)
         }
         else if (desiredTop < loc.top) {
            return newMaximum(currentMax - 1)
         }

         return currentMax
      }
      const location = (index: number, direction: Direction): { top: number, height: number } => {
         const ref = childRefs.current[index]

         if (ref || index === 0) {
            return { top: ref?.offsetTop ?? 0, height: ref?.offsetHeight ?? estimatedChildHeight }
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
         return { min: newMinimum(prev.min), max: newMaximum(prev.max) }
      })
   }, [children, estimatedChildHeight, elm, setRenderedRange])
   const scrolled = useCallback(() => {
      if (Math.abs(lastUpdateOffset.current - elm.current!.scrollTop) / 2 >= estimatedChildHeight / 2) {
         lastUpdateOffset.current = elm.current!.scrollTop
         updateRenderedComponents()
      }
   }, [lastUpdateOffset, elm, estimatedChildHeight, updateRenderedComponents])

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
         {children.length > 0 && iterate(renderedRange, i => children[i] ? React.cloneElement(children[i], { ref: (el: any) => { childRefs.current[i] = el } }) : undefined)}
         <div style={{ height: estimatedChildHeight * (children.length - 1 - renderedRange.max) + "px" }} />
      </div>
   )
}