import { Future } from "../../entities/generic/Future.js";
import type { Job, JobError } from "../../entities/Job.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import { getJobDefinition } from "../../jobs/RegisteredJobs.js";

export type RecordJobFailureInput = {
  readonly id: string;
  readonly error: JobError;
  readonly now: Date;
  readonly lockedBy: string;
  readonly lockedAt: Date;
};

export class RecordJobFailureUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: RecordJobFailureInput): Future<Error, Job | undefined> {
    return this.jobRepository.getById(input.id).flatMap((job) => {
      if (!job) {
        return Future.error(new Error(`Job not found: ${input.id}`));
      }

      const definition = getJobDefinition(job.type);
      const canRetry = Boolean(definition && job.attempts < job.maxAttempts);

      if (!canRetry || !definition) {
        return this.jobRepository.recordFailure({
          id: input.id,
          error: input.error,
          now: input.now,
          lockedBy: input.lockedBy,
          lockedAt: input.lockedAt,
        });
      }

      const retryDelayMs = computeRetryDelayMs(definition.retryPolicy, job.attempts);
      const nextAvailableAt = new Date(input.now.getTime() + retryDelayMs);

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

function computeRetryDelayMs(
  retryPolicy: {
    readonly type: "exponential";
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
  },
  attempts: number,
): number {
  const exponent = Math.max(attempts - 1, 0);
  const delayMs = retryPolicy.initialDelayMs * 2 ** exponent;
  return Math.min(delayMs, retryPolicy.maxDelayMs);
}
