import { describe, expect, it } from "vitest";

import { ValidationError } from "../../../shared/ValidationError.js";
import { ExtractionProfileStaticRepository } from "../ExtractionProfileStaticRepository.js";

describe("ExtractionProfileStaticRepository", () => {
  it("lists and resolves known extraction profiles", () => {
    const repository = createExtractionProfileRepository();

    expect(repository.list()).toEqual(["default"]);
    expect(repository.getById("default")).toMatchObject({
      id: "default",
      provider: "stub",
      model: "stub-model",
      prompt: {
        system:
          "You extract structured data from form images. Return only one valid JSON object and no markdown.",
        userTemplate: [
          "Form type: {{formType}}",
          "Canonical JSON Schema: {{jsonSchema}}",
          "Extraction response JSON Schema: {{responseJsonSchema}}",
          "Extraction instructions: {{instructions}}",
          "Return the extracted values under result. Return fieldConfidence as a JSON object mapping JSON Pointer paths relative to result to model-reported scores from 0 through 1 for every returned scalar value. For example, a top-level result field named country uses /country; do not prefix paths with /result. Do not add confidence entries for unextracted fields.",
          "The following images are ordered form pages.",
        ].join("\n\n"),
        instructions: "",
      },
      extractionJsonSchema: {},
    });
  });

  it("fails clearly for unknown extraction profiles", () => {
    const repository = createExtractionProfileRepository();

    expect(() => repository.getById("experimental")).toThrow(ValidationError);
    expect(() => repository.getById("experimental")).toThrow(
      "Unknown extraction profile: experimental",
    );
  });
});

function createExtractionProfileRepository() {
  return new ExtractionProfileStaticRepository({
    provider: "stub",
    model: "stub-model",
  });
}
