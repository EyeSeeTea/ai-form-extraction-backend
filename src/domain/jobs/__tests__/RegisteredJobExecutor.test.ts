import { describe, expect, it, vi } from "vitest";

import type { CountExampleItemsResult } from "../../usecases/CountExampleItemsUseCase.js";
import { Future } from "../../entities/generic/Future.js";
import type { JsonValue } from "../../entities/generic/Json.js";
import { getRegisteredJob, type RegisteredJobDependencies } from "../RegisteredJobRegistry.js";
import { RegisteredJobExecutor } from "../RegisteredJobExecutor.js";

describe("RegisteredJobExecutor", () => {
  it("executes a registered job and maps its debug result", async () => {
    const executor = createExecutor({
      countExampleItems: {
        execute: () => Future.success<Error, CountExampleItemsResult>({ exampleItemCount: 3 }),
      },
    });

    await expect(executor.execute(claimedCountJob({ sleepMs: 0 }))).resolves.toEqual({
      result: { exampleItemCount: 3 },
      debugResult: { exampleItemCount: 3 },
    });
  });

  it("returns sanitized debug input for valid jobs", () => {
    const executor = createExecutor();

    expect(executor.getDebugInput(claimedCountJob({ sleepMs: 500 }))).toEqual({ sleepMs: 500 });
    expect(executor.getDebugInput(claimedCountJob({ sleepMs: "not-a-number" }))).toEqual({});
    expect(executor.getDebugInput({ ...claimedCountJob({ sleepMs: 0 }), type: "missing" })).toEqual(
      {},
    );
  });

  it("marks invalid persisted input as non-retryable", async () => {
    const executor = createExecutor();

    await expect(
      executor.execute(claimedCountJob({ sleepMs: "not-a-number" })),
    ).rejects.toMatchObject({
      name: "NonRetryableJobError",
      code: "job_failed",
    });
  });

  it("leaves synchronous execution errors retryable", async () => {
    const executor = createExecutor({
      countExampleItems: {
        execute: () => {
          throw new Error("temporary count failure");
        },
      },
    });

    await expect(executor.execute(claimedCountJob({ sleepMs: 0 }))).rejects.toMatchObject({
      name: "Error",
      message: "temporary count failure",
    });
  });

  it("marks unknown job types as non-retryable", async () => {
    const executor = createExecutor();

    await expect(
      executor.execute({ ...claimedCountJob({ sleepMs: 0 }), type: "missing" }),
    ).rejects.toMatchObject({
      name: "NonRetryableJobError",
      code: "unknown_job_type",
    });
  });

  it("clears the timeout after successful execution", async () => {
    vi.useFakeTimers();

    try {
      const executor = createExecutor({
        countExampleItems: {
          execute: () => Future.success<Error, CountExampleItemsResult>({ exampleItemCount: 1 }),
        },
      });

      await expect(executor.execute(claimedCountJob({ sleepMs: 0 }))).resolves.toBeDefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels execution when the Registered Job timeout expires", async () => {
    vi.useFakeTimers();

    try {
      const cancel = vi.fn();
      const executor = createExecutor({
        countExampleItems: {
          execute: () =>
            Future.fromComputation<Error, CountExampleItemsResult>(() => {
              return cancel;
            }),
        },
      });

      const execution = executor.execute(claimedCountJob({ sleepMs: 0 }));
      const timeout = expect(execution).rejects.toMatchObject({ code: "job_timed_out" });
      await vi.advanceTimersByTimeAsync(70_000);

      await timeout;
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

function createExecutor(overrides: Partial<RegisteredJobDependencies> = {}): RegisteredJobExecutor {
  const unusedDependency = {
    execute: () => Future.error<Error, never>(new Error("unused dependency")),
  };

  return new RegisteredJobExecutor(getRegisteredJob, {
    countExampleItems: {
      execute: () => Future.success<Error, CountExampleItemsResult>({ exampleItemCount: 0 }),
    },
    extractForm: unusedDependency,
    genericExtractForm: unusedDependency,
    ...overrides,
  });
}

function claimedCountJob(input: JsonValue) {
  return {
    id: "job-1",
    type: "count_example_items",
    createdBy: null,
    input,
    attempts: 1,
    maxAttempts: 3,
    availableAt: new Date("2026-01-01T00:00:00.000Z"),
    lockedAt: new Date("2026-01-01T00:00:00.000Z"),
    lockedBy: "worker-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
