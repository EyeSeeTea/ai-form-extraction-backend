import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import { CompleteJobUseCase } from "../CompleteJobUseCase.js";
import { baseJob, createJobRepository, now } from "./JobTestSupport.js";
import { createExtractFormResult } from "../../../../../test/fixtures/ExtractFormFixture.js";

describe("CompleteJobUseCase", () => {
  it("marks the job as succeeded", async () => {
    const complete = vi.fn(() => Future.success<Error, Job | undefined>(baseJob));
    const repository = createJobRepository({ complete });
    const useCase = new CompleteJobUseCase(repository);

    await useCase
      .execute({
        id: baseJob.id,
        result: createExtractFormResult(),
        now,
        lockedBy: "worker-1",
        lockedAt: now,
      })
      .toPromise();

    expect(complete).toHaveBeenCalledWith({
      id: baseJob.id,
      result: createExtractFormResult(),
      now,
      lockedBy: "worker-1",
      lockedAt: now,
    });
  });
});
