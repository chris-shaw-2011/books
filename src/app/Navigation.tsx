import { useState } from "react"
import DownArrow from "./svg/DownArrow"
import SelectList, { SelectListItem } from "./components/SelectList"
import styles from "./Navigation.module.scss"
import classnames from "classnames"
import useOnclickOutside from "react-cool-onclickoutside"
import Upload from "./svg/Upload"
import Token from "../shared/api/Token"
import { VisibleComponent } from "./LoggedInAppContext"
import Users from "./svg/Users"
import Gear from "./svg/Gear"
import Lock from "./svg/Lock"
import LogOut from "./svg/LogOut"

interface Props {
   token: Token,
   setVisibleComponent: (component: VisibleComponent) => void,
   logOut: () => void,
}

export default (props: Props) => {
   const [open, setOpen] = useState(false)
   const openClassName: { [key: string]: boolean } = {}
   const ref = useOnclickOutside(() => {
      setOpen(false)
   }, { disabled: !open })

   const setVisibleComponent = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, component: VisibleComponent) => {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      props.setVisibleComponent(component)
   }

   openClassName[styles.open] = open

   return (
      <div className={classnames(styles.downArrow, openClassName)} onClick={() => setOpen(s => !s)} ref={ref}>
         <DownArrow />
         <SelectList className={styles.navlist} open={open}>
            <SelectListItem onClick={e => setVisibleComponent(e, VisibleComponent.Upload)}><Upload /> Upload Books</SelectListItem>
            {props.token.user.isAdmin &&
               <>
                  <SelectListItem onClick={e => setVisibleComponent(e, VisibleComponent.Users)}><Users /> Manage Users</SelectListItem>
                  <SelectListItem onClick={e => setVisibleComponent(e, VisibleComponent.Settings)}><Gear /> Settings</SelectListItem>
               </>}
            <hr />
            <SelectListItem onClick={e => setVisibleComponent(e, VisibleComponent.ChangePassword)}><Lock /> Change Password</SelectListItem>
            <SelectListItem onClick={() => props.logOut()}><LogOut /> Log Out</SelectListItem>
         </SelectList>
      </div>
   )
}