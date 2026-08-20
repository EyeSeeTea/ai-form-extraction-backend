import type { Job } from "../entities/Job.js";
import type { RetryPolicy } from "./JobDefinition.js";
import { getRegisteredJob } from "./RegisteredJobRegistry.js";

export function getNextJobAttemptAt(
  job: Pick<Job, "type" | "attempts" | "maxAttempts">,
  now: Date,
): Date | undefined {
  const retryPolicy = getRegisteredJob(job.type)?.definition.retryPolicy;
  if (!retryPolicy || job.attempts >= job.maxAttempts) {
    return undefined;
  }

  return new Date(now.getTime() + computeRetryDelayMs(retryPolicy, job.attempts));
}

function computeRetryDelayMs(retryPolicy: RetryPolicy, attempts: number): number {
  const exponent = Math.max(attempts - 1, 0);
  return Math.min(retryPolicy.initialDelayMs * 2 ** exponent, retryPolicy.maxDelayMs);
}
