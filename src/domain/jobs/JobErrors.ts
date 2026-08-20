import type { JobFailureCode } from "../entities/JobFailureCode.js";

export class NonRetryableJobError extends Error {
  override readonly name = "NonRetryableJobError";
  readonly code?: JobFailureCode | undefined;

  constructor(message: string, cause?: unknown, code?: JobFailureCode) {
    super(message);
    this.code = code;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function isNonRetryableJobError(error: unknown): boolean {
  return error instanceof NonRetryableJobError;
}

export class JobTimeoutError extends Error {
  override readonly name = "JobTimeoutError";
  readonly code = "job_timed_out";

  constructor(jobType: string, timeoutMs: number) {
    super(`Job ${jobType} timed out after ${String(timeoutMs)}ms`);
  }
}
