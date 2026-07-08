import type { Future } from "../../domain/entities/generic/Future.js";
import type { ClaimedJob, JobError } from "../../domain/entities/Job.js";
import { isJobFailureCode, type JobFailureCode } from "../../domain/entities/JobFailureCode.js";
import {
  executeJobDefinition,
  type ExecutedJobDefinition,
  type JobRegistry,
} from "../../domain/jobs/RegisteredJobs.js";
import { JobTimeoutError, NonRetryableJobError } from "../../domain/jobs/JobErrors.js";
import type { CountExampleItemsJobDependencies } from "../../domain/jobs/count-example-items/CountExampleItemsJob.js";
import type { ExtractFormJobDependencies } from "../../domain/jobs/extract-form/ExtractFormJob.js";
import type { GenericExtractFormJobDependencies } from "../../domain/jobs/generic-extract-form/GenericExtractFormJob.js";
import type { JsonValue } from "../../domain/entities/generic/Json.js";

export type JobExecutorDependencies = CountExampleItemsJobDependencies &
  ExtractFormJobDependencies &
  GenericExtractFormJobDependencies;
export type JobExecutionResult = ExecutedJobDefinition & {
  readonly result: JsonValue;
};

export class JobExecutor {
  constructor(
    private readonly jobRegistry: JobRegistry,
    private readonly dependencies: JobExecutorDependencies,
  ) {}

  async execute(job: ClaimedJob): Promise<JobExecutionResult> {
    if (!(job.type in this.jobRegistry)) {
      throw new NonRetryableJobError(
        `Unknown job type: ${job.type}`,
        undefined,
        "unknown_job_type",
      );
    }
    const definition = this.jobRegistry[job.type as keyof JobRegistry];

    const execution: Future<Error, JobExecutionResult> = executeJobDefinition(
      definition,
      job.input,
      this.dependencies,
    );

    return withTimeout(execution, definition.timeoutMs, job.type);
  }
}

async function withTimeout<Result>(
  execution: Future<Error, Result>,
  timeoutMs: number,
  jobType: string,
): Promise<Result> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      execution.toPromise(),
      new Promise<Result>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new JobTimeoutError(jobType, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function toJobError(error: unknown): JobError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: classifyJobFailure(error),
      name: error.name,
      stack: error.stack,
      cause: serializeErrorCause(error.cause),
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown job error",
    code: "job_failed",
  };
}

function serializeErrorCause(cause: unknown): JsonValue | undefined {
  if (cause === undefined) {
    return undefined;
  }

  if (cause instanceof Error) {
    return errorToJsonValue(cause);
  }

  if (
    cause === null ||
    typeof cause === "string" ||
    typeof cause === "number" ||
    typeof cause === "boolean"
  ) {
    return cause;
  }

  if (Array.isArray(cause)) {
    return cause.map((item) => serializeErrorCause(item) ?? null);
  }

  if (typeof cause === "object") {
    return Object.fromEntries(
      Object.entries(cause as Record<string, unknown>).map(([key, value]) => [
        key,
        serializeErrorCause(value) ?? null,
      ]),
    );
  }

  return "[unsupported cause]";
}

function errorToJsonValue(error: Error): JsonValue {
  const value: Record<string, JsonValue> = {
    message: error.message,
  };

  const code = getErrorCode(error);
  if (code) {
    value["code"] = code;
  }

  if (error.name) {
    value["name"] = error.name;
  }

  if (error.stack) {
    value["stack"] = error.stack;
  }

  if (error.cause !== undefined) {
    value["cause"] = serializeErrorCause(error.cause) ?? null;
  }

  return value;
}

function getErrorCode(error: Error): string | undefined {
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

function classifyJobFailure(error: unknown): JobFailureCode {
  const code = getUnknownErrorCode(error);
  if (isJobFailureCode(code)) {
    return code;
  }

  const cause = error instanceof Error ? error.cause : undefined;
  if (cause !== undefined) {
    return classifyJobFailure(cause);
  }

  return "job_failed";
}

function getUnknownErrorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;
}
