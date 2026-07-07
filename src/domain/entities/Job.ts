import type { JsonValue } from "./generic/Json.js";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobType = string;

export type JobError = {
  readonly message: string;
  readonly name?: string | undefined;
  readonly stack?: string | undefined;
  readonly cause?: JsonValue | undefined;
};

export type Job = {
  readonly id: string;
  readonly type: JobType;
  readonly createdBy: string | null;
  readonly status: JobStatus;
  readonly input: JsonValue;
  readonly result?: JsonValue | undefined;
  readonly error?: JobError | undefined;
  readonly lastError?: JobError | undefined;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: Date;
  readonly lockedAt?: Date | undefined;
  readonly lockedBy?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ClaimedJob = {
  readonly id: string;
  readonly type: JobType;
  readonly createdBy: string | null;
  readonly input: JsonValue;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: Date;
  readonly lockedAt: Date;
  readonly lockedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};
