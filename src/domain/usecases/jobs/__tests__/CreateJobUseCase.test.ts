import { describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import { CreateJobUseCase } from "../CreateJobUseCase.js";
import { baseJob, createJobRepository, now } from "./JobTestSupport.js";

describe("CreateJobUseCase", () => {
  it("rejects unknown types", async () => {
    const useCase = new CreateJobUseCase(createJobRepository());

    await expect(
      useCase.execute({ type: "unknown", createdBy: null, input: {} }, now).toPromise(),
    ).rejects.toThrow("Unknown job type: unknown");
  });

  it("rejects invalid input", async () => {
    const useCase = new CreateJobUseCase(createJobRepository());

    await expect(
      useCase
        .execute(
          {
            type: "extract_form",
            createdBy: null,
            input: {
              formType: "end-of-season",
              document: {
                bundleId: "",
                createdAt: "not-a-date",
                kind: "pdf",
                files: [],
              },
            },
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
          createdBy: "system",
          input: {
            formType: "end-of-season",
            document: {
              bundleId: "bundle-1",
              createdAt: "2026-01-01T12:00:00.000Z",
              kind: "pdf",
              files: [
                {
                  bundleId: "bundle-1",
                  storageKey: "bundle-1/001.pdf",
                  originalFilename: "form.pdf",
                  mimetype: "application/pdf",
                  size: 1024,
                  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                },
              ],
            },
          },
        },
        now,
      )
      .toPromise();

    expect(create).toHaveBeenCalledWith({
      type: "extract_form",
      createdBy: "system",
      input: {
        formType: "end-of-season",
        document: {
          bundleId: "bundle-1",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-1",
              storageKey: "bundle-1/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
      maxAttempts: 3,
      availableAt: now,
    });
  });

  it("accepts valid count example items input", async () => {
    const create = vi.fn(() => Future.success<Error, Job>(baseJob));
    const repository = createJobRepository({ create });
    const useCase = new CreateJobUseCase(repository);

    await useCase
      .execute(
        {
          type: "count_example_items",
          createdBy: null,
          input: {
            sleepMs: 250,
          },
        },
        now,
      )
      .toPromise();

    expect(create).toHaveBeenCalledWith({
      type: "count_example_items",
      createdBy: null,
      input: {
        sleepMs: 250,
      },
      maxAttempts: 3,
      availableAt: now,
    });
  });
});
