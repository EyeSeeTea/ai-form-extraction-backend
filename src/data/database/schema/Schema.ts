import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const exampleItems = sqliteTable("example_items", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
