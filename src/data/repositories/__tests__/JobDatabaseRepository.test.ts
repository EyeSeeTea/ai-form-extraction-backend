import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { JobDatabaseRepository } from "../JobDatabaseRepository.js";
import {
  beginTestTransaction,
  closeTestDatabase,
  createStaticIdGenerator,
  createTestDatabase,
  rollbackTestTransaction,
  seedJob,
} from "./TestDatabase.js";

describe("JobDatabaseRepository", () => {
  const client = createTestDatabase();

  function createRepository() {
    return new JobDatabaseRepository(
      client.db,
      createStaticIdGenerator("00000000-0000-4000-8000-000000000001"),
    );
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

  it("creates and gets a job by id", async () => {
    const repository = createRepository();
    const availableAt = new Date("2026-01-01T10:00:00.000Z");

    const created = await repository
      .create({
        type: "extract_form",
        input: { formId: "form-1", sourceUrl: "https://example.org/forms/1" },
        maxAttempts: 3,
        availableAt,
      })
      .toPromise();

    expect(created).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      type: "extract_form",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      availableAt,
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    await expect(repository.getById(created.id).toPromise()).resolves.toEqual(created);
  });

  it("claims the oldest available queued job", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-b",
      type: "extract_form",
      status: "queued",
      inputJson: JSON.stringify({ formId: "form-b", sourceUrl: "https://example.org/b" }),
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      createdAt: new Date("2026-01-01T10:10:00.000Z"),
      updatedAt: new Date("2026-01-01T10:10:00.000Z"),
    });
    await seedJob(client.db, {
      id: "job-a",
      type: "extract_form",
      status: "queued",
      inputJson: JSON.stringify({ formId: "form-a", sourceUrl: "https://example.org/a" }),
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T09:00:00.000Z"),
      createdAt: new Date("2026-01-01T09:10:00.000Z"),
      updatedAt: new Date("2026-01-01T09:10:00.000Z"),
    });

    const claimed = await repository
      .claimNext({
        lockedBy: "worker-1",
        now,
        staleRunningBefore: new Date("2026-01-01T11:00:00.000Z"),
      })
      .toPromise();

    expect(claimed?.id).toBe("job-a");
  });

  it("ignores jobs scheduled for the future", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-future",
      type: "extract_form",
      status: "queued",
      inputJson: JSON.stringify({ formId: "form-future", sourceUrl: "https://example.org/future" }),
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T13:00:00.000Z"),
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    });

    await expect(
      repository
        .claimNext({
          lockedBy: "worker-1",
          now,
          staleRunningBefore: new Date("2026-01-01T11:00:00.000Z"),
        })
        .toPromise(),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when no work exists", async () => {
    const repository = createRepository();

    await expect(
      repository
        .claimNext({
          lockedBy: "worker-1",
          now: new Date("2026-01-01T12:00:00.000Z"),
          staleRunningBefore: new Date("2026-01-01T11:00:00.000Z"),
        })
        .toPromise(),
    ).resolves.toBeUndefined();
  });

  it("increments attempts and sets lock fields when claiming", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-lock",
      type: "extract_form",
      status: "queued",
      inputJson: JSON.stringify({ formId: "form-lock", sourceUrl: "https://example.org/lock" }),
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    });

    const claimed = await repository
      .claimNext({
        lockedBy: "worker-1",
        now,
        staleRunningBefore: new Date("2026-01-01T11:00:00.000Z"),
      })
      .toPromise();

    expect(claimed).toMatchObject({
      id: "job-lock",
      status: "running",
      attempts: 1,
      lockedBy: "worker-1",
    });
    expect(claimed?.lockedAt).toEqual(now);
  });

  it("does not return the same job twice under concurrent claims", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-once",
      type: "extract_form",
      status: "queued",
      inputJson: JSON.stringify({ formId: "form-once", sourceUrl: "https://example.org/once" }),
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    });

    const [first, second] = await Promise.all([
      repository
        .claimNext({
          lockedBy: "worker-1",
          now,
          staleRunningBefore: new Date("2026-01-01T11:00:00.000Z"),
        })
        .toPromise(),
      repository
        .claimNext({
          lockedBy: "worker-2",
          now,
          staleRunningBefore: new Date("2026-01-01T11:00:00.000Z"),
        })
        .toPromise(),
    ]);

    expect([first?.id, second?.id].filter(Boolean)).toEqual(["job-once"]);
  });

  it("completes a job and clears the lock", async () => {
    const repository = createRepository();
    const startedAt = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-complete",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({
        formId: "form-complete",
        sourceUrl: "https://example.org/complete",
      }),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      lockedBy: "worker-1",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:59:00.000Z"),
    });

    const completed = await repository
      .complete({
        id: "job-complete",
        result: { formId: "form-complete", placeholder: true },
        now: startedAt,
        lockedBy: "worker-1",
        lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      })
      .toPromise();

    if (!completed) {
      throw new Error("Expected completed job");
    }

    expect(completed).toMatchObject({
      id: "job-complete",
      status: "succeeded",
      result: { formId: "form-complete", placeholder: true },
    });
    expect(completed.lockedAt).toBeUndefined();
    expect(completed.lockedBy).toBeUndefined();
  });

  it("does not complete a job when the lease no longer matches", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-complete-stale",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({
        formId: "form-complete-stale",
        sourceUrl: "https://example.org/complete-stale",
      }),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      lockedBy: "worker-2",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:59:00.000Z"),
    });

    const completed = await repository
      .complete({
        id: "job-complete-stale",
        result: { formId: "form-complete-stale", placeholder: true },
        now,
        lockedBy: "worker-1",
        lockedAt: new Date("2026-01-01T11:58:00.000Z"),
      })
      .toPromise();

    expect(completed).toBeUndefined();
    await expect(repository.getById("job-complete-stale").toPromise()).resolves.toMatchObject({
      id: "job-complete-stale",
      status: "running",
      lockedBy: "worker-2",
    });
  });

  it("requeues a failed job and clears the lock", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");
    const nextAvailableAt = new Date("2026-01-01T12:00:01.000Z");

    await seedJob(client.db, {
      id: "job-retry",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({ formId: "form-retry", sourceUrl: "https://example.org/retry" }),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      lockedBy: "worker-1",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:59:00.000Z"),
    });

    const updated = await repository
      .recordFailure({
        id: "job-retry",
        error: { message: "temporary failure" },
        now,
        lockedBy: "worker-1",
        lockedAt: new Date("2026-01-01T11:59:00.000Z"),
        nextAvailableAt,
      })
      .toPromise();

    if (!updated) {
      throw new Error("Expected updated job");
    }

    expect(updated).toMatchObject({
      id: "job-retry",
      status: "queued",
      availableAt: nextAvailableAt,
      lastError: { message: "temporary failure" },
    });
    expect(updated.result).toBeUndefined();
    expect(updated.lockedAt).toBeUndefined();
    expect(updated.lockedBy).toBeUndefined();
  });

  it("stores the final error and clears the lock", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-failed",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({ formId: "form-failed", sourceUrl: "https://example.org/failed" }),
      attempts: 3,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      lockedBy: "worker-1",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:59:00.000Z"),
    });

    const updated = await repository
      .recordFailure({
        id: "job-failed",
        error: { message: "permanent failure" },
        now,
        lockedBy: "worker-1",
        lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      })
      .toPromise();

    if (!updated) {
      throw new Error("Expected updated job");
    }

    expect(updated).toMatchObject({
      id: "job-failed",
      status: "failed",
      error: { message: "permanent failure" },
      lastError: { message: "permanent failure" },
    });
    expect(updated.lockedAt).toBeUndefined();
    expect(updated.lockedBy).toBeUndefined();
  });

  it("does not record a failure when the lease no longer matches", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-failure-stale",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({
        formId: "form-failure-stale",
        sourceUrl: "https://example.org/failure-stale",
      }),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:59:00.000Z"),
      lockedBy: "worker-2",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:59:00.000Z"),
    });

    const updated = await repository
      .recordFailure({
        id: "job-failure-stale",
        error: { message: "stale failure" },
        now,
        lockedBy: "worker-1",
        lockedAt: new Date("2026-01-01T11:58:00.000Z"),
      })
      .toPromise();

    expect(updated).toBeUndefined();
    await expect(repository.getById("job-failure-stale").toPromise()).resolves.toMatchObject({
      id: "job-failure-stale",
      status: "running",
      lockedBy: "worker-2",
    });
  });

  it("reclaims a stale running job", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-stale",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({ formId: "form-stale", sourceUrl: "https://example.org/stale" }),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:00:00.000Z"),
      lockedBy: "worker-old",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:00:00.000Z"),
    });

    const reclaimed = await repository
      .claimNext({
        lockedBy: "worker-new",
        now,
        staleRunningBefore: new Date("2026-01-01T11:30:00.000Z"),
      })
      .toPromise();

    expect(reclaimed).toMatchObject({
      id: "job-stale",
      status: "running",
      attempts: 2,
      lockedBy: "worker-new",
    });
  });

  it("does not reclaim a non-stale running job", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-fresh",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({ formId: "form-fresh", sourceUrl: "https://example.org/fresh" }),
      attempts: 1,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:50:00.000Z"),
      lockedBy: "worker-old",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:50:00.000Z"),
    });

    await expect(
      repository
        .claimNext({
          lockedBy: "worker-new",
          now,
          staleRunningBefore: new Date("2026-01-01T11:30:00.000Z"),
        })
        .toPromise(),
    ).resolves.toBeUndefined();
  });

  it("marks a stale exhausted running job as failed without returning it", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-exhausted",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({
        formId: "form-exhausted",
        sourceUrl: "https://example.org/exhausted",
      }),
      attempts: 3,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:00:00.000Z"),
      lockedBy: "worker-old",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:00:00.000Z"),
    });

    await expect(
      repository
        .claimNext({
          lockedBy: "worker-new",
          now,
          staleRunningBefore: new Date("2026-01-01T11:30:00.000Z"),
        })
        .toPromise(),
    ).resolves.toBeUndefined();

    await expect(repository.getById("job-exhausted").toPromise()).resolves.toMatchObject({
      id: "job-exhausted",
      status: "failed",
      attempts: 3,
      error: {
        message: "Job exhausted retry attempts before lease recovery",
        name: "JobLeaseExpiredError",
      },
      lastError: {
        message: "Job exhausted retry attempts before lease recovery",
        name: "JobLeaseExpiredError",
      },
    });
  });

  it("skips an exhausted stale running job and claims the next runnable job", async () => {
    const repository = createRepository();
    const now = new Date("2026-01-01T12:00:00.000Z");

    await seedJob(client.db, {
      id: "job-exhausted",
      type: "extract_form",
      status: "running",
      inputJson: JSON.stringify({
        formId: "form-exhausted",
        sourceUrl: "https://example.org/exhausted",
      }),
      attempts: 3,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T10:00:00.000Z"),
      lockedAt: new Date("2026-01-01T11:00:00.000Z"),
      lockedBy: "worker-old",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:00:00.000Z"),
    });
    await seedJob(client.db, {
      id: "job-next",
      type: "extract_form",
      status: "queued",
      inputJson: JSON.stringify({
        formId: "form-next",
        sourceUrl: "https://example.org/next",
      }),
      attempts: 0,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T11:30:00.000Z"),
      createdAt: new Date("2026-01-01T11:30:00.000Z"),
      updatedAt: new Date("2026-01-01T11:30:00.000Z"),
    });

    const claimed = await repository
      .claimNext({
        lockedBy: "worker-new",
        now,
        staleRunningBefore: new Date("2026-01-01T11:30:00.000Z"),
      })
      .toPromise();

    expect(claimed?.id).toBe("job-next");
  });
});
