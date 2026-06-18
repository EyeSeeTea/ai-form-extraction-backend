import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import { GetJobUseCase } from "../GetJobUseCase.js";
import { baseJob, createJobRepository } from "./JobTestSupport.js";

describe("GetJobUseCase", () => {
  it("delegates to the repository", async () => {
    const getById = vi.fn(() => Future.success<Error, Job | undefined>(baseJob));
    const repository = createJobRepository({ getById });
    const useCase = new GetJobUseCase(repository);

    await useCase.execute(baseJob.id).toPromise();

    expect(getById).toHaveBeenCalledWith(baseJob.id);
  });
});
