import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";

import { DbError } from "../../utils/drizzle-future.js";
import { ExampleItemDatabaseRepository } from "../ExampleItemDatabaseRepository.js";
import {
  beginTestTransaction,
  closeTestDatabase,
  createStaticIdGenerator,
  createTestDatabase,
  rollbackTestTransaction,
  seedExampleItem,
} from "./TestDatabase.js";

describe("ExampleItemDatabaseRepository", () => {
  const client = createTestDatabase();

  function createRepository(client: ReturnType<typeof createTestDatabase>) {
    return new ExampleItemDatabaseRepository(client.db, createStaticIdGenerator());
  }

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

  it("lists items ordered by creation time", async () => {
    const repository = createRepository(client);

    await seedExampleItem(client.db, {
      id: "b0000000-0000-0000-0000-000000000002",
      name: "Second",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    await seedExampleItem(client.db, {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "First",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(repository.list().toPromise()).resolves.toEqual([
      {
        id: "a0000000-0000-0000-0000-000000000001",
        name: "First",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "b0000000-0000-0000-0000-000000000002",
        name: "Second",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);
  });

  it("creates and returns the persisted row", async () => {
    const repository = new ExampleItemDatabaseRepository(client.db, createStaticIdGenerator());

    const created = await repository
      .create({
        name: "Created",
      })
      .toPromise();

    expect(created).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Created",
    });
    expect(created.createdAt).toBeInstanceOf(Date);

    await expect(repository.list().toPromise()).resolves.toHaveLength(1);
  });

  it("updates an existing row", async () => {
    const repository = createRepository(client);

    await seedExampleItem(client.db, {
      id: "d0000000-0000-0000-0000-000000000004",
      name: "Before",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(
      repository.update("d0000000-0000-0000-0000-000000000004", { name: "After" }).toPromise(),
    ).resolves.toMatchObject({
      id: "d0000000-0000-0000-0000-000000000004",
      name: "After",
    });
  });

  it("returns undefined when updating a missing row", async () => {
    const repository = createRepository(client);

    await expect(
      repository.update("00000000-0000-0000-0000-000000000000", { name: "Missing" }).toPromise(),
    ).resolves.toBeUndefined();
  });

  it("maps database errors to DbError", async () => {
    const repository = new ExampleItemDatabaseRepository(
      client.db,
      createStaticIdGenerator("00000000-0000-4000-8000-000000000005"),
    );

    await repository
      .create({
        name: "Initial",
      })
      .toPromise();

    const duplicate = repository
      .create({
        name: "Duplicate",
      })
      .toPromise();

    await expect(duplicate).rejects.toBeInstanceOf(DbError);
    await expect(duplicate).rejects.toMatchObject({
      kind: "sqlite",
      operation: "create example item",
    });
  });
});
