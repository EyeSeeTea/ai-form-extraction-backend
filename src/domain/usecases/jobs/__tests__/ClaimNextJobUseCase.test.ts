import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import { ClaimNextJobUseCase } from "../ClaimNextJobUseCase.js";
import { createJobRepository, now } from "./JobTestSupport.js";

describe("ClaimNextJobUseCase", () => {
  it("delegates to the repository", async () => {
    const claimNext = vi.fn(() => Future.success<Error, Job | undefined>(undefined));
    const repository = createJobRepository({ claimNext });
    const useCase = new ClaimNextJobUseCase(repository, 120_000);
    const staleRunningBefore = new Date("2026-01-01T11:58:00.000Z");

    await useCase
      .execute({
        lockedBy: "worker-1",
        now,
        staleRunningBefore,
      })
      .toPromise();

    expect(claimNext).toHaveBeenCalledWith({
      lockedBy: "worker-1",
      now,
      staleRunningBefore,
    });
  });
});
