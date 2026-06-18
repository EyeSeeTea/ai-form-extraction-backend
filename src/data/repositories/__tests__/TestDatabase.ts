import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createDatabaseClient } from "../../database/Database.js";
import { exampleItems, jobs } from "../../database/schema/Schema.js";
import type { IdGenerator } from "../../utils/IdGenerator.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../drizzle",
);

export type TestDatabaseClient = ReturnType<typeof createTestDatabase>;

export function createTestDatabase() {
  const client = createDatabaseClient(":memory:");
  migrate(client.db, { migrationsFolder });
  return client;
}

export function beginTestTransaction(db: TestDatabaseClient["db"]) {
  db.run(sql`begin`);
}

export function rollbackTestTransaction(db: TestDatabaseClient["db"]) {
  db.run(sql`rollback`);
}

export function createStaticIdGenerator(id = "00000000-0000-4000-8000-000000000001"): IdGenerator {
  return {
    generate: () => id,
  };
}

export async function closeTestDatabase(client: TestDatabaseClient) {
  await client.close();
}

export async function seedExampleItem(
  db: TestDatabaseClient["db"],
  item: {
    id: string;
    name: string;
    createdAt: Date;
  },
) {
  await db.insert(exampleItems).values(item);
}

export async function seedJob(
  db: TestDatabaseClient["db"],
  job: {
    id: string;
    type: string;
    status: "queued" | "running" | "succeeded" | "failed";
    inputJson: string;
    resultJson?: string | null;
    errorJson?: string | null;
    lastErrorJson?: string | null;
    attempts: number;
    maxAttempts: number;
    availableAt: Date;
    lockedAt?: Date | null;
    lockedBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  await db.insert(jobs).values({
    ...job,
    resultJson: job.resultJson ?? null,
    errorJson: job.errorJson ?? null,
    lastErrorJson: job.lastErrorJson ?? null,
    lockedAt: job.lockedAt ?? null,
    lockedBy: job.lockedBy ?? null,
  });
}
