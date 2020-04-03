import React, { useRef } from "react"
import Books from "../shared/api/Books"
import Book from "../shared/Book"
import Directory from "../shared/Directory"
import { ItemType } from "../shared/ItemType"
import BookLink from "./BookLink"
import DirectoryLink from "./DirectoryLink"
import { AutoSizer, CellMeasurer, List, CellMeasurerCache } from "react-virtualized"
import { CellMeasurerChildProps } from "react-virtualized/dist/es/CellMeasurer"

interface Props {
   items: (Directory | Book)[],
   className?: string,
   searchWords: string[],
   statusChanged: (books: Books) => void,
   rootItemList?: boolean,
   measure?: () => void,
}

interface ItemLinkProps {
   item: Directory | Book,
   props: Props,
   cellMeasurerChildProps?: CellMeasurerChildProps,
   style?: React.CSSProperties
}

// tslint:disable-next-line: variable-name
const ItemLink = ({ item, props, cellMeasurerChildProps, style }: ItemLinkProps) => (
   item.type === ItemType.book ?
      <BookLink book={item} className={props.className} searchWords={props.searchWords} statusChanged={props.statusChanged} cellMeasurerChildProps={cellMeasurerChildProps} style={style} /> :
      <DirectoryLink directory={item} className={props.className} searchWords={props.searchWords} statusChanged={props.statusChanged} cellMeasurerChildProps={cellMeasurerChildProps} style={style} />
)

export default (props: Props) => {
   const cache = useRef(new CellMeasurerCache({
      defaultHeight: 197,
      fixedWidth: true,
   }))

   if (props.rootItemList) {
      return (
         <AutoSizer>
            {({ width, height }) => (
               <List
                  rowCount={props.items.length}
                  rowHeight={cache.current.rowHeight}
                  width={width}
                  height={height}
                  rowRenderer={({ index, key, parent, style }) => (
                     <CellMeasurer cache={cache.current} parent={parent} key={key} rowIndex={index} columnIndex={0}>
                        {args =>
                           <ItemLink item={props.items[index]} props={props} cellMeasurerChildProps={args} style={style} key={props.items[index].id} />
                        }
                     </CellMeasurer>
                  )}
               />)}
         </AutoSizer>
      )
   }
   else {
      return (
         <>
            {props.items.map(item => <ItemLink item={item} key={item.id} props={props} cellMeasurerChildProps={{ measure: props.measure || (() => { return }) }} />)}
         </>
      )
   }
}