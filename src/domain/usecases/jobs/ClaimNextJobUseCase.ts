import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { Maybe } from "../../../utils/ts-utils.js";
import type { JobRepository } from "../../repositories/JobRepository.js";

export type ClaimNextJobInput = Readonly<{
  lockedBy: string;
  now: Date;
  staleRunningBefore?: Date;
}>;

export class ClaimNextJobUseCase {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly leaseTimeoutMs = 120_000,
  ) {}

  execute(input: ClaimNextJobInput): Future<Error, Maybe<Job>> {
    const staleRunningBefore =
      input.staleRunningBefore ?? new Date(input.now.getTime() - this.leaseTimeoutMs);

    return this.jobRepository.claimNext({
      lockedBy: input.lockedBy,
      now: input.now,
      staleRunningBefore,
    });
  }
}
