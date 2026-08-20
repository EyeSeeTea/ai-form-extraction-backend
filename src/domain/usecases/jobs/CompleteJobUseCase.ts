import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import type { JsonValue } from "../../entities/generic/Json.js";

export type CompleteJobInput = Readonly<{
  id: string;
  result: unknown;
  now: Date;
  lockedBy: string;
  lockedAt: Date;
}>;

export class CompleteJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: CompleteJobInput): Future<Error, Job | undefined> {
    return this.jobRepository.complete({
      id: input.id,
      result: input.result as JsonValue,
      now: input.now,
      lockedBy: input.lockedBy,
      lockedAt: input.lockedAt,
    });
  }
}
