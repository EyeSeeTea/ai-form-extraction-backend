import type { Future } from "../../domain/entities/generic/Future.js";
import type { ClaimedJob, JobError, JsonValue } from "../../domain/entities/Job.js";
import { type JobRegistry } from "../../domain/jobs/JobRegistry.js";
import type { ExtractFormJobDependencies } from "../../domain/jobs/extract-form/ExtractFormJob.js";

export type JobExecutorDependencies = ExtractFormJobDependencies;

export class JobExecutor {
  constructor(
    private readonly jobRegistry: JobRegistry,
    private readonly dependencies: JobExecutorDependencies,
  ) {}

  async execute(job: ClaimedJob): Promise<JsonValue> {
    const definition = Object.values(this.jobRegistry).find(
      (candidate) => candidate.type === job.type,
    );
    if (definition === undefined) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    const parsedInput = definition.inputSchema.parse(job.input);
    const execution = definition.execute(parsedInput, this.dependencies);

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
          reject(new Error(`Job ${jobType} timed out after ${String(timeoutMs)}ms`));
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
      name: error.name,
      stack: error.stack,
      cause: serializeErrorCause(error.cause),
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown job error",
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
