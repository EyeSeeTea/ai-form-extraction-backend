import type { Future } from "../entities/generic/Future.js";
import type { Maybe } from "../../utils/ts-utils.js";
import type { Job, JobError, JsonValue } from "../entities/Job.js";

export type CreateJobInput = {
  readonly type: string;
  readonly input: JsonValue;
  readonly maxAttempts: number;
  readonly availableAt: Date;
};

export type ClaimNextJobInput = {
  readonly lockedBy: string;
  readonly now: Date;
  readonly staleRunningBefore: Date;
};

export type CompleteJobInput = {
  readonly id: string;
  readonly result: JsonValue;
  readonly now: Date;
  readonly lockedBy: string;
  readonly lockedAt: Date;
};

export type RecordJobFailureInput = {
  readonly id: string;
  readonly error: JobError;
  readonly now: Date;
  readonly lockedBy: string;
  readonly lockedAt: Date;
  readonly nextAvailableAt?: Date;
};

export interface JobRepository {
  create(input: CreateJobInput): Future<Error, Job>;
  getById(id: string): Future<Error, Maybe<Job>>;
  claimNext(input: ClaimNextJobInput): Future<Error, Maybe<Job>>;
  complete(input: CompleteJobInput): Future<Error, Maybe<Job>>;
  recordFailure(input: RecordJobFailureInput): Future<Error, Maybe<Job>>;
}
