import type { JsonValue } from "./generic/Json.js";
import type { JobFailureCode } from "./JobFailureCode.js";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobType = string;

export type JobError = {
  readonly message: string;
  readonly code: JobFailureCode;
  readonly name?: string | undefined;
  readonly stack?: string | undefined;
  readonly cause?: JsonValue | undefined;
};

type StoredJob = {
  readonly id: string;
  readonly type: JobType;
  readonly createdBy: string | null;
  readonly input: JsonValue;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Job = StoredJob & {
  readonly status: JobStatus;
  readonly result?: JsonValue | undefined;
  readonly error?: JobError | undefined;
  readonly lastError?: JobError | undefined;
  readonly lockedAt?: Date | undefined;
  readonly lockedBy?: string | undefined;
};

export type ClaimedJob = StoredJob & {
  readonly lockedAt: Date;
  readonly lockedBy: string;
};
