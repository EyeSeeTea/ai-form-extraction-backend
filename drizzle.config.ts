import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/data/database/schema/Schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env["DATABASE_PATH"] ?? "./app.sqlite",
  },
});
