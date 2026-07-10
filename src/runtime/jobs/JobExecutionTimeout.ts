import type { Future } from "../../domain/entities/generic/Future.js";
import { JobTimeoutError } from "../../domain/jobs/JobErrors.js";

export function executeWithJobTimeout<Result>(
  execution: Future<Error, Result>,
  timeoutMs: number,
  jobType: string,
): Promise<Result> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  return new Promise<Result>((resolve, reject) => {
    let settled = false;

    const settleOnceAndClearTimeout = (callback: () => void) => {
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
        settleOnceAndClearTimeout(() => {
          resolve(result);
        });
      },
      (error) => {
        settleOnceAndClearTimeout(() => {
          reject(error);
        });
      },
    );

    timeoutHandle = setTimeout(() => {
      cancel?.();
      settleOnceAndClearTimeout(() => {
        reject(new JobTimeoutError(jobType, timeoutMs));
      });
    }, timeoutMs);
  });
}
