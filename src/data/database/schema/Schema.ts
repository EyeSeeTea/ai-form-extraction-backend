import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const exampleItems = sqliteTable("example_items", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").notNull().primaryKey(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    inputJson: text("input_json").notNull(),
    resultJson: text("result_json"),
    errorJson: text("error_json"),
    lastErrorJson: text("last_error_json"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull(),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    lockedBy: text("locked_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(strftime('%s', 'now') as integer) * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(strftime('%s', 'now') as integer) * 1000)`),
  },
  (table) => [
    index("jobs_status_available_at_created_at_idx").on(
      table.status,
      table.availableAt,
      table.createdAt,
    ),
    index("jobs_status_locked_at_idx").on(table.status, table.lockedAt),
  ],
);
