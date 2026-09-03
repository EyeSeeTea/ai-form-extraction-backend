import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
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

  it("checks the database lazily when the future is run", async () => {
    const run = vi.spyOn(client.db, "run");
    const repository = new HealthDatabaseRepository(client.db);

    const future = repository.check();
    expect(run).not.toHaveBeenCalled();

    await expect(future.toPromise()).resolves.toEqual({ reachable: true });
    expect(run).toHaveBeenCalledOnce();
  });
});
