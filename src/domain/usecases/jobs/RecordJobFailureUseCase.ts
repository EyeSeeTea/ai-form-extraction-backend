import { Future } from "../../entities/generic/Future.js";
import type { Job, JobError } from "../../entities/Job.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import { getNextJobAttemptAt } from "../../jobs/RegisteredJobRetryPolicy.js";

export type RecordJobFailureInput = {
  readonly id: string;
  readonly error: JobError;
  readonly now: Date;
  readonly lockedBy: string;
  readonly lockedAt: Date;
  readonly retryable?: boolean;
};

export class RecordJobFailureUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: RecordJobFailureInput): Future<Error, Job | undefined> {
    return this.jobRepository.getById(input.id).flatMap((job) => {
      if (!job) {
        return Future.error(new Error(`Job not found: ${input.id}`));
      }

      const nextAvailableAt = getNextJobAttemptAt(job, input.now);

      if (input.retryable === false || !nextAvailableAt) {
        return this.jobRepository.recordFailure({
          id: input.id,
          error: input.error,
          now: input.now,
          lockedBy: input.lockedBy,
          lockedAt: input.lockedAt,
        });
      }

      return this.jobRepository.recordFailure({
        id: input.id,
        error: input.error,
        now: input.now,
        lockedBy: input.lockedBy,
        lockedAt: input.lockedAt,
        nextAvailableAt,
      });
    });
  }
}
