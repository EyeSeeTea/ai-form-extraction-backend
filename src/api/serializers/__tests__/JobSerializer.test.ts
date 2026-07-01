import { describe, expect, it } from "vitest";

import type { Job } from "../../../domain/entities/Job.js";
import { serializeJob } from "../JobSerializer.js";

describe("serializeJob", () => {
  it("does not expose internal job error details to API callers", () => {
    const job: Job = {
      id: "job-1",
      type: "extract_form",
      status: "failed",
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
      error: {
        message: "boom",
        name: "Error",
        stack: "stack trace",
        cause: {
          internalPath: "/tmp/secret",
        },
      },
      lastError: {
        message: "boom",
        name: "Error",
        stack: "stack trace",
        cause: {
          internalPath: "/tmp/secret",
        },
      },
      attempts: 3,
      maxAttempts: 3,
      availableAt: new Date("2026-01-01T12:00:00.000Z"),
      lockedAt: undefined,
      lockedBy: undefined,
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    };

    const serialized = serializeJob(job);

    expect(serialized).toMatchObject({
      status: "failed",
      error: {
        message: "boom",
        code: "JOB_FAILED",
      },
    });
    expect(serialized).not.toHaveProperty("error.stack");
    expect(serialized).not.toHaveProperty("error.cause");
    expect(serialized).not.toHaveProperty("error.name");
  });
});
