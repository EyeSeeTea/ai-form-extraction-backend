import type { ClaimedJob } from "../entities/Job.js";
import type { Future } from "../entities/generic/Future.js";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";
import { NonRetryableJobError, JobTimeoutError } from "./JobErrors.js";
import {
  type ExecutedRegisteredJob,
  type RegisteredJobDependencies,
  type RegisteredJobLookup,
} from "./RegisteredJobRegistry.js";

export class RegisteredJobExecutor {
  constructor(
    private readonly getRegisteredJob: RegisteredJobLookup,
    private readonly dependencies: RegisteredJobDependencies,
  ) {}

  async execute(job: ClaimedJob): Promise<ExecutedRegisteredJob> {
    const registeredJob = this.getRegisteredJob(job.type);
    if (!registeredJob) {
      throw new NonRetryableJobError(
        `Unknown job type: ${job.type}`,
        undefined,
        "unknown_job_type",
      );
    }

    let parsedInput: JsonValue;
    try {
      parsedInput = registeredJob.definition.inputSchema.parse(job.input);
    } catch (error) {
      throw new NonRetryableJobError(
        `Invalid input for job type: ${job.type}`,
        error,
        "job_failed",
      );
    }

    const execution = registeredJob.execute(parsedInput, this.dependencies);
    return executeWithJobTimeout(execution, registeredJob.definition.timeoutMs, job.type);
  }

  getDebugInput(job: ClaimedJob): JsonObject {
    return this.getRegisteredJob(job.type)?.getDebugInput(job.input) ?? {};
  }
}

function executeWithJobTimeout<Result>(
  execution: Future<Error, Result>,
  timeoutMs: number,
  jobType: string,
): Promise<Result> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  return new Promise<Result>((resolve, reject) => {
    let settled = false;
    const settleOnce = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      callback();
    };
    const cancel = execution.run(
      (result) => {
        settleOnce(() => {
          resolve(result);
        });
      },
      (error) => {
        settleOnce(() => {
          reject(error);
        });
      },
    );

    timeoutHandle = setTimeout(() => {
      cancel?.();
      settleOnce(() => {
        reject(new JobTimeoutError(jobType, timeoutMs));
      });
    }, timeoutMs);
  });
}
