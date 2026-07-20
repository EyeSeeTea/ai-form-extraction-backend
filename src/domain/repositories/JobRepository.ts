import type { Future } from "../entities/generic/Future.js";
import type { Maybe } from "../../utils/ts-utils.js";
import type { Job, JobError } from "../entities/Job.js";
import type { JsonValue } from "../entities/generic/Json.js";

export type CreateJobInput = Readonly<{
  type: string;
  createdBy: string | null;
  input: JsonValue;
  maxAttempts: number;
  availableAt: Date;
}>;

export type ClaimNextJobInput = Readonly<{
  lockedBy: string;
  now: Date;
  staleRunningBefore: Date;
}>;

export type CompleteJobInput = Readonly<{
  id: string;
  result: JsonValue;
  now: Date;
  lockedBy: string;
  lockedAt: Date;
}>;

export type RecordJobFailureInput = Readonly<{
  id: string;
  error: JobError;
  now: Date;
  lockedBy: string;
  lockedAt: Date;
  nextAvailableAt?: Date;
}>;

export interface JobRepository {
  create(input: CreateJobInput): Future<Error, Job>;
  getById(id: string): Future<Error, Maybe<Job>>;
  claimNext(input: ClaimNextJobInput): Future<Error, Maybe<Job>>;
  complete(input: CompleteJobInput): Future<Error, Maybe<Job>>;
  recordFailure(input: RecordJobFailureInput): Future<Error, Maybe<Job>>;
}
