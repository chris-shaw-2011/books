import { useState } from "react"
import { Status } from "../shared/Book"
import Directory from "../shared/Directory"
import Books from "../shared/api/Books"
import SortOrder from "../shared/SortOrder"
import { DropdownButton, Dropdown } from "react-bootstrap"
import Styles from "./ItemListTabContent.module.scss"
import classNames from "classnames"
import VirtualList from "./VirtualList"
import ItemLink from "./ItemLink"

interface BookTabProps {
   dir: Directory,
   status?: Status,
   searchWords: string[],
   statusChanged: (books: Books) => void,
   hidden: boolean,
}

export default (props: BookTabProps) => {
   const [sort, setSort] = useState(SortOrder.AlphabeticallyAscending)
   const items = new Directory(props.dir, undefined, sort)

   return (
      <>
         <div className={classNames(Styles.sortDropDown, { [Styles.hidden]: props.hidden })}>
            <DropdownButton title={`Sorted: ${sort}`} id={`${props.status || "All"}-sortButton`} variant="secondary">
               {Object.values(SortOrder).map(s => (
                  <Dropdown.Item key={s} onClick={() => setSort(s)}>{s}</Dropdown.Item>
               ))}
            </DropdownButton>
         </div>

         <VirtualList estimatedChildHeight={195} className={classNames({ [Styles.hidden]: props.hidden })}>
            {items.items.map(i => <ItemLink key={i.id} item={i} {...props} />)}
         </VirtualList>
      </>
   )
}