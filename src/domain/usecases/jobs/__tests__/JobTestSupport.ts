import { vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import type { JobRepository } from "../../../repositories/JobRepository.js";

export const now = new Date("2026-01-01T12:00:00.000Z");

export const baseJob: Job = {
  id: "job-1",
  type: "extract_form",
  status: "running",
  input: {
    formId: "form-1",
    sourceUrl: "https://example.org/forms/1",
  },
  attempts: 1,
  maxAttempts: 3,
  availableAt: now,
  lockedAt: now,
  lockedBy: "worker-1",
  createdAt: now,
  updatedAt: now,
};

export function createJobRepository(options: Partial<JobRepository> = {}): JobRepository {
  return createJobRepositoryForJob(baseJob, options);
}

export function createJobRepositoryForJob(
  job: Job,
  options: Partial<JobRepository> = {},
): JobRepository {
  return {
    create:
      options.create ??
      vi.fn(() => {
        return Future.success<Error, Job>(job);
      }),
    getById:
      options.getById ??
      vi.fn(() => {
        return Future.success<Error, Job | undefined>(job);
      }),
    claimNext:
      options.claimNext ??
      vi.fn(() => {
        return Future.success<Error, Job | undefined>(job);
      }),
    complete:
      options.complete ??
      vi.fn(() => {
        return Future.success<Error, Job | undefined>(job);
      }),
    recordFailure:
      options.recordFailure ??
      vi.fn(() => {
        return Future.success<Error, Job | undefined>(job);
      }),
  };
}
