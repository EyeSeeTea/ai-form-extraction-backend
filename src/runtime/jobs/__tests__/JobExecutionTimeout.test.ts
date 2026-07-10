import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../domain/entities/generic/Future.js";
import { JobTimeoutError } from "../../../domain/jobs/JobErrors.js";
import { executeWithJobTimeout } from "../JobExecutionTimeout.js";

describe("executeWithJobTimeout", () => {
  it("cancels the running future when it times out", async () => {
    const cancel = vi.fn();
    vi.useFakeTimers();

    try {
      const execution = executeWithJobTimeout(
        Future.fromComputation(() => cancel),
        10,
        "slow_job",
      );
      const expectTimeout = expect(execution).rejects.toBeInstanceOf(JobTimeoutError);
      await vi.advanceTimersByTimeAsync(10);

      await expectTimeout;
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
