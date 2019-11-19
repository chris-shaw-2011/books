import React from "react"
import { Tabs, Tab } from "react-bootstrap"
import Directory from "../shared/Directory"
import { Status } from "../shared/Book";
import Loading from "./Loading"
import { ItemType } from "../shared/ItemType";
import ItemList from "./ItemList";
import Api from "./Api";
import Token from "../shared/Token";
import Unauthorized from "../shared/Unauthorized";
import AccessDenied from "../shared/AccessDenied";

interface Props {
   searchWords: Array<string>,
   token: Token,
   onUnauthorized: (message?: string) => void
}

interface State {
   books: Directory,
   loading: boolean,
}

export default class LoggedIn extends React.Component<Props, State> {
   state = {
      books: new Directory(),
      loading: true,
   }

   async componentDidMount() {
      var books = await Api.books(this.props.token)

      if (!books) {
         this.props.onUnauthorized("Something unexpected happened")
      }
      else if (books instanceof Unauthorized || books instanceof AccessDenied) {
         this.props.onUnauthorized(books.message);
      }
      else {
         this.setState({
            books: books,
            loading: false,
         })
      }

   }

   filter(dir: Directory, status: Status) {
      var ret = new Directory()
      var search = this.props.searchWords;

      ret.name = dir.name

      dir.items.forEach(i => {
         if (i.type === ItemType.book && i.status === status) {
            var lAuthor = i.author.toLowerCase();
            var lName = i.name.toLowerCase();
            var lComment = i.comment.toLowerCase();

            if (!this.props.searchWords.length || search.every(s => lAuthor.indexOf(s) !== -1 || lName.indexOf(s) !== -1 || lComment.indexOf(s) !== -1)) {
               ret.items.push(i)
            }
         }
         else if (i.type === ItemType.directory) {
            var rec = this.filter(i as Directory, status);

            if (rec.items.length) {
               ret.items.push(rec)
            }
         }
      })

      return ret;
   }

   statusChanged = () => {
      this.forceUpdate();
   }

   render() {
      if (this.state.loading) {
         return (
            <Loading />
         )
      }

      var unreadBooks = this.filter(this.state.books, Status.Unread);
      var readBooks = this.filter(this.state.books, Status.Read);

      return (
         <Tabs defaultActiveKey="unread" id="main-tab">
            <Tab eventKey="unread" title={`Unread (${unreadBooks.bookCount()})`} >
               <ItemList items={unreadBooks.items} className="rootItemList" searchWords={this.props.searchWords} statusChanged={this.statusChanged} />
            </Tab>
            <Tab eventKey="read" title={`Read (${readBooks.bookCount()})`} >
               <ItemList items={readBooks.items} className="rootItemList" searchWords={this.props.searchWords} statusChanged={this.statusChanged} />
            </Tab>
         </Tabs>
      )
   }
}

