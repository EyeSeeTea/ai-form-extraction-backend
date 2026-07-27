import { randomUUID } from "node:crypto";

import type { Job } from "../../src/domain/entities/Job.js";
import { Future } from "../../src/domain/entities/generic/Future.js";
import type {
  ClaimNextJobInput,
  CompleteJobInput,
  CreateJobInput,
  JobRepository,
  RecordJobFailureInput,
} from "../../src/domain/repositories/JobRepository.js";
import type { Maybe } from "../../src/utils/ts-utils.js";

export function createJobMockRepository(initialJobs: Job[] = []): JobRepository {
  const jobs = new Map<string, Job>(initialJobs.map((job) => [job.id, job]));

  return {
    create(input: CreateJobInput): Future<Error, Job> {
      const id = randomUUID();
      const now = new Date();
      const job: Job = {
        id,
        type: input.type,
        status: "queued",
        input: input.input,
        attempts: 0,
        maxAttempts: input.maxAttempts,
        availableAt: input.availableAt,
        createdAt: now,
        updatedAt: now,
      };

      jobs.set(id, job);
      return Future.success(job);
    },

    getById(id: string): Future<Error, Maybe<Job>> {
      return Future.success(jobs.get(id));
    },

    claimNext(input: ClaimNextJobInput): Future<Error, Maybe<Job>> {
      const candidates = [...jobs.values()].filter((job) => {
        if (job.status === "queued") {
          return job.availableAt <= input.now;
        }

        return (
          job.status === "running" &&
          job.lockedAt !== undefined &&
          job.lockedAt <= input.staleRunningBefore &&
          job.attempts < job.maxAttempts
        );
      });

      candidates.sort((left, right) => {
        const availableDelta = left.availableAt.getTime() - right.availableAt.getTime();
        if (availableDelta !== 0) {
          return availableDelta;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });

      const job = candidates[0];
      if (!job) {
        return Future.success(undefined);
      }

      const claimed: Job = {
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        lockedAt: input.now,
        lockedBy: input.lockedBy,
        updatedAt: input.now,
      };

      jobs.set(job.id, claimed);
      return Future.success(claimed);
    },

    complete(input: CompleteJobInput): Future<Error, Maybe<Job>> {
      const job = jobs.get(input.id);
      if (!job) {
        return Future.error(new Error(`Job not found: ${input.id}`));
      }

      if (
        job.status !== "running" ||
        job.lockedAt?.getTime() !== input.lockedAt.getTime() ||
        job.lockedBy !== input.lockedBy
      ) {
        return Future.success(undefined);
      }

      const completed: Job = {
        ...job,
        status: "succeeded",
        result: input.result,
        error: undefined,
        lockedAt: undefined,
        lockedBy: undefined,
        updatedAt: input.now,
      };

      jobs.set(job.id, completed);
      return Future.success(completed);
    },

    recordFailure(input: RecordJobFailureInput): Future<Error, Maybe<Job>> {
      const job = jobs.get(input.id);
      if (!job) {
        return Future.error(new Error(`Job not found: ${input.id}`));
      }

      if (
        job.status !== "running" ||
        job.lockedAt?.getTime() !== input.lockedAt.getTime() ||
        job.lockedBy !== input.lockedBy
      ) {
        return Future.success(undefined);
      }

      const failed: Job = input.nextAvailableAt
        ? {
            ...job,
            status: "queued",
            result: undefined,
            error: undefined,
            lastError: input.error,
            availableAt: input.nextAvailableAt,
            lockedAt: undefined,
            lockedBy: undefined,
            updatedAt: input.now,
          }
        : {
            ...job,
            status: "failed",
            result: undefined,
            error: input.error,
            lastError: input.error,
            availableAt: input.now,
            lockedAt: undefined,
            lockedBy: undefined,
            updatedAt: input.now,
          };

      jobs.set(job.id, failed);
      return Future.success(failed);
    },
  };
}
