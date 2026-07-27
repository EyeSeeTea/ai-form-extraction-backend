import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";

import { HealthDatabaseRepository } from "../HealthDatabaseRepository.js";
import {
  beginTestTransaction,
  closeTestDatabase,
  createTestDatabase,
  rollbackTestTransaction,
} from "./TestDatabase.js";

describe("HealthDatabaseRepository", () => {
  const client = createTestDatabase();

  beforeAll(() => {
    beginTestTransaction(client.db);
  });

  afterEach(async () => {
    rollbackTestTransaction(client.db);
    beginTestTransaction(client.db);
  });

  afterAll(async () => {
    await closeTestDatabase(client);
  });

  it("reports the database as reachable", async () => {
    const repository = new HealthDatabaseRepository(client.db);

    await expect(repository.check().toPromise()).resolves.toEqual({ reachable: true });
  });
});
