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

export type Job = Readonly<{
  id: string;
  type: JobType;
  createdBy: string | null;
  status: JobStatus;
  input: JsonValue;
  result?: JsonValue | undefined;
  error?: JobError | undefined;
  lastError?: JobError | undefined;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt?: Date | undefined;
  lockedBy?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ClaimedJob = Readonly<{
  id: string;
  type: JobType;
  createdBy: string | null;
  input: JsonValue;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date;
  lockedBy: string;
  createdAt: Date;
  updatedAt: Date;
}>;
