import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema/Schema.js";

export type Database = BetterSQLite3Database<typeof schema>;
export type DatabaseClient = {
  readonly db: Database;
  close(): Promise<void>;
};

function isFileBackedDatabasePath(databasePath: string): boolean {
  if (databasePath === ":memory:") {
    return false;
  }
  if (databasePath.startsWith("file::memory:")) {
    return false;
  }
  if (databasePath.startsWith("file:") && databasePath.includes("mode=memory")) {
    return false;
  }
  return true;
}

export function createDatabaseClient(databasePath: string): DatabaseClient {
  if (isFileBackedDatabasePath(databasePath)) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const connection = new BetterSqlite3(databasePath, {
    timeout: 5000,
  });

  connection.pragma("foreign_keys = ON");

  if (isFileBackedDatabasePath(databasePath)) {
    connection.pragma("journal_mode = WAL");
    connection.pragma("synchronous = NORMAL");
  }

  const db = drizzle({ client: connection, schema });

  return {
    db,
    close: () => {
      connection.close();
      return Promise.resolve();
    },
  };
}
