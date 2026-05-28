import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/data/database/schema/Schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://app:app@localhost:5432/app",
  },
});
