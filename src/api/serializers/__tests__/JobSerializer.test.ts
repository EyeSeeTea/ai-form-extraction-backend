import { describe, expect, it } from "vitest";

import type { Job } from "../../../domain/entities/Job.js";
import { serializeJob } from "../JobSerializer.js";

describe("serializeJob", () => {
  it("does not expose internal job error details to API callers", () => {
    const serialized = serializeJob(
      createFailedJob({
        id: "job-1",
        lastError: {
          message: "boom",
          code: "job_failed",
          name: "Error",
          stack: "stack trace",
          cause: {
            internalPath: "/tmp/secret",
          },
        },
        error: {
          message: "boom",
          code: "job_failed",
          name: "Error",
          stack: "stack trace",
          cause: {
            internalPath: "/tmp/secret",
          },
        },
      }),
    );

    expect(serialized).toMatchObject({
      status: "failed",
      error: {
        message: "boom",
        code: "job_failed",
      },
    });
    expect(serialized).not.toHaveProperty("error.stack");
    expect(serialized).not.toHaveProperty("error.cause");
    expect(serialized).not.toHaveProperty("error.name");
  });

  it("surfaces the persisted job error code", () => {
    const serialized = serializeJob(
      createFailedJob({
        id: "job-2",
        error: {
          message: "PDF document contains no pages",
          code: "pdf_document_contains_no_pages",
          name: "NonRetryableJobError",
          cause: {
            message: "PDF document contains no pages",
            name: "DocumentPreparationError",
            code: "pdf_document_contains_no_pages",
          },
        },
      }),
    );

    expect(serialized).toMatchObject({
      status: "failed",
      error: {
        message: "PDF document contains no pages",
        code: "pdf_document_contains_no_pages",
      },
    });
  });

  it("does not infer public codes from internal error details", () => {
    const serialized = serializeJob(
      createFailedJob({
        id: "job-3",
        type: "generic_extract_form",
        error: {
          message: "Invalid input: expected string, received number",
          code: "job_failed",
          name: "NonRetryableJobError",
          cause: {
            message: "Invalid input: expected string, received number",
            name: "ValidationError",
          },
        },
      }),
    );

    expect(serialized).toMatchObject({
      status: "failed",
      error: {
        message: "Invalid input: expected string, received number",
        code: "job_failed",
      },
    });
  });

  it("falls back to generic codes when no better classification is available", () => {
    const serialized = serializeJob(
      createFailedJob({
        id: "job-4",
        type: "count_example_items",
        error: {
          message: "boom",
          code: "job_failed",
          name: "Error",
        },
      }),
    );

    expect(serialized).toMatchObject({
      status: "failed",
      error: {
        message: "boom",
        code: "job_failed",
      },
    });
  });
});

function createFailedJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    type: "extract_form",
    createdBy: null,
    status: "failed",
    input: {},
    error: {
      message: "boom",
      code: "job_failed",
    },
    lastError: undefined,
    attempts: 1,
    maxAttempts: 3,
    availableAt: new Date("2026-01-01T12:00:00.000Z"),
    lockedAt: undefined,
    lockedBy: undefined,
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    ...overrides,
  };
}
