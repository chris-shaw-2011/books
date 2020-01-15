import sqlite from "sqlite"
import { SQLStatement } from "sql-template-strings";
import ServerSettings from "./ServerSettings"

class Database implements sqlite.Database {
   private db?: sqlite.Database
   noUsers: boolean
   settings: ServerSettings

   async open() {
      if (!this.db) {
         this.db = await sqlite.open("db.sqlite")
         await this.db.exec(`
            CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT, hash TEXT, isAdmin BOOLEAN, lastLogin BIGINT, bookStatuses TEXT);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_user_email ON user (email);
         `)

         await this.db.exec("PRAGMA user_version = 1");

         this.settings = new ServerSettings(this.db)

         await this.settings.loadFromDatabase()

         this.noUsers = (await this.db.get("SELECT COUNT(1) as userCount FROM user")).userCount == 0

         if (this.noUsers) {
            console.warn("Currently there are no users in the database so the first login attempt will create a user")
         }
      }
   }

   close(): Promise<void> {
      return this.db.close()
   }

   run(sql: string | SQLStatement): Promise<sqlite.Statement>;
   run(sql: string | SQLStatement, params: any[]): Promise<sqlite.Statement>;
   run(sql: any, rest?: any[]) {
      return this.db.run(sql, rest)
   }

   get(sql: string | SQLStatement): Promise<any>;
   get(sql: string | SQLStatement, params: any[]): Promise<any>;
   get<T>(sql: string | SQLStatement): Promise<T>;
   get<T>(sql: string | SQLStatement, params: any[]): Promise<T>;
   get(sql: any, rest?: any[]) {
      return this.db.get(sql, rest)
   }

   all(sql: string | SQLStatement): Promise<any[]>;
   all(sql: string | SQLStatement, params: any[]): Promise<any[]>;
   all<T>(sql: string | SQLStatement): Promise<T[]>;
   all<T>(sql: string | SQLStatement, params: any[]): Promise<T[]>;
   all(sql: any, ...rest: any[]) {
      return this.db.all(sql, rest)
   }

   exec(sql: string): Promise<sqlite.Database> {
      return this.db.exec(sql)
   }

   each(sql: string | SQLStatement, callback?: (err: Error, row: any) => void): Promise<number>;
   each(sql: string | SQLStatement, params: any[]): Promise<number>;
   each(sql: any, callback?: any, rest?: any[]) {
      return this.db.each(sql, callback, rest)
   }

   prepare(sql: string | SQLStatement): Promise<sqlite.Statement>;
   prepare(sql: string | SQLStatement, params: any[]): Promise<sqlite.Statement>;
   prepare(sql: any, rest?: any[]) {
      return this.db.prepare(sql, rest)
   }

   configure(option: "busyTimeout", value: number): void;
   configure(option: string, value: any): void;
   configure(option: any, value: any) {
      this.db.configure(option, value)
   }

   migrate(options: { force?: string; table?: string; migrationsPath?: string; }): Promise<sqlite.Database> {
      return this.db.migrate(options)
   }

   on(event: "trace", listener: (sql: string) => void): void;
   on(event: "profile", listener: (sql: string, time: number) => void): void;
   on(event: "error", listener: (err: Error) => void): void;
   on(event: "open" | "close", listener: () => void): void;
   on(event: string, listener: (...args: any[]) => void): void;
   on(event: any, listener: any) {
      this.db.on(event, listener)
   }
}

const val = new Database()

export default val;