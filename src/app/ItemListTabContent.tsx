import React, { useState } from "react"
import { Status } from "../shared/Book"
import Directory from "../shared/Directory"
import Books from "../shared/api/Books"
import SortOrder from "../shared/SortOrder"
import { DropdownButton, Dropdown } from "react-bootstrap"
import ItemList from "./ItemList"

interface BookTabProps {
   dir: Directory,
   status?: Status,
   searchWords: string[],
   statusChanged: (books: Books) => void,
}

export default (props: BookTabProps) => {
   const [sort, setSort] = useState(SortOrder.AlphabeticallyAscending)
   const items = new Directory(props.dir, undefined, sort)

   return (
      <>
         <div className="sortDropDown">
            <DropdownButton title={`Sorted: ${sort}`} id={`${props.status || "All"}-sortButton`} variant="secondary">
               {Object.values(SortOrder).map(s => (
                  <Dropdown.Item key={s} onClick={() => setSort(s)}>{s}</Dropdown.Item>
               ))}
            </DropdownButton>
         </div>

         <ItemList items={items.items} className="rootItemList" searchWords={props.searchWords} statusChanged={props.statusChanged} rootItemList={true} />
      </>
   )
}