import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import { CreateJobUseCase } from "../CreateJobUseCase.js";
import { baseJob, createJobRepository, now } from "./JobTestSupport.js";

describe("CreateJobUseCase", () => {
  it("rejects unknown types", async () => {
    const useCase = new CreateJobUseCase(createJobRepository());

    await expect(useCase.execute({ type: "unknown", input: {} }, now).toPromise()).rejects.toThrow(
      "Unknown job type: unknown",
    );
  });

  it("rejects invalid input", async () => {
    const useCase = new CreateJobUseCase(createJobRepository());

    await expect(
      useCase
        .execute(
          {
            type: "extract_form",
            input: { formId: "", sourceUrl: "not-a-url" },
          },
          now,
        )
        .toPromise(),
    ).rejects.toBeInstanceOf(Error);
  });

  it("persists the registry max attempts", async () => {
    const create = vi.fn(() => Future.success<Error, Job>(baseJob));
    const repository = createJobRepository({ create });
    const useCase = new CreateJobUseCase(repository);

    await useCase
      .execute(
        {
          type: "extract_form",
          input: {
            formId: "form-1",
            sourceUrl: "https://example.org/forms/1",
          },
        },
        now,
      )
      .toPromise();

    expect(create).toHaveBeenCalledWith({
      type: "extract_form",
      input: {
        formId: "form-1",
        sourceUrl: "https://example.org/forms/1",
      },
      maxAttempts: 3,
      availableAt: now,
    });
  });
});
