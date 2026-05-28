import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const exampleItems = pgTable("example_items", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
