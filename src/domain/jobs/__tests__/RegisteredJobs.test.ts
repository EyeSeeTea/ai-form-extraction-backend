import { describe, expect, it } from "vitest";

import {
  getDefinitionDebugResult,
  getJobDebugInput,
  getJobDefinition,
  getJobDefinitionsBySubmissionMode,
  isKnownJobType,
  parseJobInput,
} from "../RegisteredJobs.js";

describe("registered jobs", () => {
  it("returns no definition for an unknown type", () => {
    expect(getJobDefinition("missing")).toBeUndefined();
    expect(isKnownJobType("missing")).toBe(false);
  });

  it("parses valid extract form input", () => {
    expect(isKnownJobType("extract_form")).toBe(true);
    expect(getJobDefinition("extract_form")?.submissionMode).toBe("multipart");
    expect(getJobDefinitionsBySubmissionMode("json").map((definition) => definition.type)).toEqual([
      "count_example_items",
    ]);
    expect(
      getJobDefinitionsBySubmissionMode("multipart").map((definition) => definition.type),
    ).toEqual(["extract_form"]);

    const parsed = parseJobInput("extract_form", {
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
    });

    expect(parsed).toEqual({
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
    });
  });

  it("rejects invalid extract form input", () => {
    expect(() =>
      parseJobInput("extract_form", {
        formId: "",
        sourceUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("parses valid count example items input", () => {
    expect(isKnownJobType("count_example_items")).toBe(true);
    expect(getJobDefinition("count_example_items")?.submissionMode).toBe("json");

    const parsed = parseJobInput("count_example_items", {
      sleepMs: 500,
    });

    expect(parsed).toEqual({
      sleepMs: 500,
    });
  });

  it("returns debug fields from the job definition", () => {
    const countExampleItemsDefinition = getJobDefinition("count_example_items");

    expect(
      getJobDebugInput("count_example_items", {
        sleepMs: 500,
      }),
    ).toEqual({
      sleepMs: 500,
    });

    expect(countExampleItemsDefinition).toBeDefined();
    expect(
      countExampleItemsDefinition
        ? getDefinitionDebugResult(countExampleItemsDefinition, {
            exampleItemCount: 3,
          })
        : undefined,
    ).toEqual({
      exampleItemCount: 3,
    });

    expect(
      getJobDebugInput("extract_form", {
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
      }),
    ).toEqual({
      formType: "end-of-season",
      bundleId: "bundle-1",
      documentKind: "pdf",
      fileCount: 1,
    });
  });

  it("returns empty debug fields when the input shape is invalid", () => {
    expect(getJobDebugInput("count_example_items", { sleepMs: "bad" })).toEqual({});
    expect(getJobDebugInput("missing", { anything: true })).toEqual({});
  });
});
