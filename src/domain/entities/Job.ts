import type { JsonValue } from "./generic/Json.js";
import type { JobFailureCode } from "./JobFailureCode.js";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobType = string;

export type JobError = Readonly<{
  message: string;
  code: JobFailureCode;
  name?: string | undefined;
  stack?: string | undefined;
  cause?: JsonValue | undefined;
}>;

type StoredJob = Readonly<{
  id: string;
  type: JobType;
  createdBy: string | null;
  input: JsonValue;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type Job = StoredJob &
  Readonly<{
    status: JobStatus;
    result?: JsonValue | undefined;
    error?: JobError | undefined;
    lastError?: JobError | undefined;
    lockedAt?: Date | undefined;
    lockedBy?: string | undefined;
  }>;

export type ClaimedJob = StoredJob &
  Readonly<{
    lockedAt: Date;
    lockedBy: string;
  }>;
