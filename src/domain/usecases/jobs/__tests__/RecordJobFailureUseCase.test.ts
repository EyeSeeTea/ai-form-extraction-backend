import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job, JobError } from "../../../entities/Job.js";
import type { RecordJobFailureInput } from "../RecordJobFailureUseCase.js";
import { RecordJobFailureUseCase } from "../RecordJobFailureUseCase.js";
import { baseJob, createJobRepository, now } from "./JobTestSupport.js";

describe("RecordJobFailureUseCase", () => {
  it("requeues a failed attempt with a deterministic retry delay", async () => {
    const failure: JobError = { message: "temporary failure" };
    const getById = vi.fn(() => Future.success<Error, Job>(baseJob));
    const recordFailure = vi.fn((input: RecordJobFailureInput) =>
      Future.success<Error, Job>({ ...baseJob, ...input }),
    );
    const repository = createJobRepository({ getById, recordFailure });
    const useCase = new RecordJobFailureUseCase(repository);

    await useCase
      .execute({
        id: baseJob.id,
        error: failure,
        now,
        lockedBy: "worker-1",
        lockedAt: now,
      })
      .toPromise();

    expect(recordFailure).toHaveBeenCalledWith({
      id: baseJob.id,
      error: failure,
      now,
      lockedBy: "worker-1",
      lockedAt: now,
      nextAvailableAt: new Date("2026-01-01T12:00:01.000Z"),
    });
  });

  it("marks the job as failed when attempts are exhausted", async () => {
    const failure: JobError = { message: "permanent failure" };
    const exhaustedJob: Job = {
      ...baseJob,
      attempts: 3,
      maxAttempts: 3,
    };
    const getById = vi.fn(() => Future.success<Error, Job>(exhaustedJob));
    const recordFailure = vi.fn((input: RecordJobFailureInput) =>
      Future.success<Error, Job>({ ...exhaustedJob, ...input }),
    );
    const repository = createJobRepository({ getById, recordFailure });
    const useCase = new RecordJobFailureUseCase(repository);

    await useCase
      .execute({
        id: exhaustedJob.id,
        error: failure,
        now,
        lockedBy: "worker-1",
        lockedAt: now,
      })
      .toPromise();

    expect(recordFailure).toHaveBeenCalledWith({
      id: exhaustedJob.id,
      error: failure,
      now,
      lockedBy: "worker-1",
      lockedAt: now,
    });
  });

  it("does not reschedule non-retryable failures while attempts remain", async () => {
    const failure: JobError = { message: "bad input" };
    const getById = vi.fn(() => Future.success<Error, Job>(baseJob));
    const recordFailure = vi.fn((input: RecordJobFailureInput) =>
      Future.success<Error, Job>({ ...baseJob, ...input }),
    );
    const repository = createJobRepository({ getById, recordFailure });
    const useCase = new RecordJobFailureUseCase(repository);

    await useCase
      .execute({
        id: baseJob.id,
        error: failure,
        now,
        lockedBy: "worker-1",
        lockedAt: now,
        retryable: false,
      })
      .toPromise();

    expect(recordFailure).toHaveBeenCalledWith({
      id: baseJob.id,
      error: failure,
      now,
      lockedBy: "worker-1",
      lockedAt: now,
    });
  });
});
