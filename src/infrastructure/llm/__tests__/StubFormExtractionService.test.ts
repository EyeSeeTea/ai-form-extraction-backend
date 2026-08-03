import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { FormExtractionConfigurationError } from "../../../domain/services/FormExtractionErrors.js";
import { StubFormExtractionService } from "../StubFormExtractionService.js";

describe("StubFormExtractionService", () => {
  it("generates a deterministic schema-compliant result and scalar confidence map", async () => {
    const service = new StubFormExtractionService({
      extractionJsonSchema: {
        type: "object",
        properties: {
          country: { type: "string", enum: ["Kenya", "Uganda"] },
          reported_on: { type: "string", format: "date" },
          amount: { type: "integer", minimum: 5, maximum: 10 },
          code: { type: "string", pattern: "^[A-Z]{2}$" },
          tags: {
            type: "array",
            minItems: 2,
            items: { type: "string", enum: ["rain", "sun"] },
          },
          contact: { type: "string", format: "email" },
        },
        required: ["country", "reported_on", "amount", "code", "tags"],
        additionalProperties: false,
      },
    });

    const first = await service.extract(createInput()).toPromise();
    const second = await service.extract(createInput()).toPromise();

    expect(first.extractedFields).toEqual({
      country: "Kenya",
      reported_on: "2026-01-01",
      amount: 5,
      code: "AA",
      tags: ["rain", "rain"],
      contact: "stub@example.test",
    });
    expect(second.extractedFields).toEqual(first.extractedFields);
    expect(first.fieldConfidence).toEqual({
      "/country": 0.91,
      "/reported_on": 0.88,
      "/amount": 0.85,
      "/code": 0.82,
      "/tags/0": 0.79,
      "/tags/1": 0.76,
      "/contact": 0.73,
    });
  });

  it("rejects schemas it cannot synthesize", () => {
    expect(
      () =>
        new StubFormExtractionService({
          extractionJsonSchema: {
            type: "object",
            properties: {
              identifier: { type: "string", pattern: "^[A-Z]{2}-[0-9]{4}$" },
            },
          },
        }),
    ).toThrow(FormExtractionConfigurationError);
  });

  it("normalizes malformed schema constraints into a configuration error", () => {
    expect(
      () =>
        new StubFormExtractionService({
          extractionJsonSchema: {
            type: "object",
            properties: { value: { type: "string", pattern: "(" } },
          },
        }),
    ).toThrow(FormExtractionConfigurationError);
  });

  it("omits confidence when it was not requested", async () => {
    const service = new StubFormExtractionService({
      extractionJsonSchema: {
        type: "object",
        properties: { answer: { type: "boolean" } },
      },
    });

    const output = await service
      .extract(createInput({ includeFieldConfidence: false }))
      .toPromise();

    expect(output).not.toHaveProperty("fieldConfidence");
  });

  it("handles zero-size collections, empty strings, negative bounds, and compatible enum values", async () => {
    const service = new StubFormExtractionService({
      extractionJsonSchema: {
        type: "object",
        properties: {
          negative: { type: "integer", maximum: -1 },
          empty_items: { type: "array", maxItems: 0, items: { type: "string" } },
          empty_text: { type: "string", maxLength: 0 },
          code: { type: "string", enum: ["x", "AA"], pattern: "^[A-Z]{2}$" },
          nullable: { type: ["string", "null"] },
          choice: { oneOf: [{ type: "boolean" }, { type: "string" }] },
        },
      },
    });

    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      extractedFields: {
        negative: -1,
        empty_items: [],
        empty_text: "",
        code: "AA",
        nullable: "Sample nullable",
        choice: true,
      },
    });
  });

  it("generates a value inside a tight exclusive numeric interval", async () => {
    const service = new StubFormExtractionService({
      extractionJsonSchema: {
        type: "object",
        properties: {
          ratio: { type: "number", exclusiveMinimum: 0, maximum: 0.25, multipleOf: 0.1 },
          bounded_integer: { type: "integer", exclusiveMinimum: 0.1, maximum: 1.1 },
          integer_multiple: { type: "integer", minimum: 1, maximum: 3, multipleOf: 0.3 },
        },
      },
    });

    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      extractedFields: { ratio: 0.1, bounded_integer: 1, integer_multiple: 3 },
    });
  });

  it("loads a form-labelled result override from the configured external directory", async () => {
    const resultsDirectory = await mkdtemp(join(tmpdir(), "stub-results-"));
    try {
      await writeFile(
        join(resultsDirectory, "end%2Fof%20season.json"),
        JSON.stringify({ answer: "Cached answer" }),
      );
      const service = createOverrideService(resultsDirectory);

      const first = await service.extract(createInput({ formType: "end/of season" })).toPromise();
      expect(first).toMatchObject({
        extractedFields: { answer: "Cached answer" },
        fieldConfidence: { "/answer": 0.91 },
      });

      await writeFile(
        join(resultsDirectory, "end%2Fof%20season.json"),
        JSON.stringify({ answer: "Updated answer" }),
      );
      await expect(
        service.extract(createInput({ formType: "end/of season" })).toPromise(),
      ).resolves.toMatchObject({ extractedFields: { answer: "Updated answer" } });
    } finally {
      await rm(resultsDirectory, { recursive: true, force: true });
    }
  });

  it("falls back to generated data when no override file exists", async () => {
    const resultsDirectory = await mkdtemp(join(tmpdir(), "stub-results-"));
    try {
      const service = createOverrideService(resultsDirectory);

      await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
        extractedFields: { answer: "Sample answer" },
      });
    } finally {
      await rm(resultsDirectory, { recursive: true, force: true });
    }
  });

  it("rejects malformed override JSON", async () => {
    const resultsDirectory = await mkdtemp(join(tmpdir(), "stub-results-"));
    try {
      await writeFile(join(resultsDirectory, "generic-form.json"), "not JSON");
      const service = createOverrideService(resultsDirectory);

      await expect(service.extract(createInput()).toPromise()).rejects.toBeInstanceOf(
        FormExtractionConfigurationError,
      );
    } finally {
      await rm(resultsDirectory, { recursive: true, force: true });
    }
  });

  it("rejects an override that does not satisfy the extraction schema", async () => {
    const resultsDirectory = await mkdtemp(join(tmpdir(), "stub-results-"));
    try {
      await writeFile(join(resultsDirectory, "generic-form.json"), JSON.stringify({ answer: 1 }));
      const service = createOverrideService(resultsDirectory);

      await expect(service.extract(createInput()).toPromise()).rejects.toBeInstanceOf(
        FormExtractionConfigurationError,
      );
    } finally {
      await rm(resultsDirectory, { recursive: true, force: true });
    }
  });
});

function createOverrideService(resultsDirectory: string): StubFormExtractionService {
  return new StubFormExtractionService({
    extractionJsonSchema: {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"],
    },
    resultsDirectory,
  });
}

function createInput(
  overrides: Partial<Readonly<{ formType: string; includeFieldConfidence: boolean }>> = {},
) {
  return {
    formType: "generic-form",
    prompt: { system: "System", userText: "User" },
    images: [],
    model: "stub-model",
    includeFieldConfidence: true,
    ...overrides,
  };
}
