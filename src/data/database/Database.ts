import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema/Schema.js";

export type Database = PostgresJsDatabase<typeof schema>;
export type DatabaseClient = {
  readonly db: Database;
  readonly sql: Sql;
  close(): Promise<void>;
};

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  const sql = postgres(databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    close: () => sql.end(),
  };
}
