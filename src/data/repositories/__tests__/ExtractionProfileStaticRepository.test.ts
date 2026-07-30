import { describe, expect, it } from "vitest";

import { ExtractionProfileStaticRepository } from "../ExtractionProfileStaticRepository.js";

describe("ExtractionProfileStaticRepository", () => {
  it("lists and resolves known extraction profiles", async () => {
    const repository = createExtractionProfileRepository();

    await expect(repository.list().toPromise()).resolves.toEqual(["default"]);
    await expect(repository.getById("default").toPromise()).resolves.toMatchObject({
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
          "{{confidenceInstructions}}",
          "The following images are ordered form pages.",
        ].join("\n\n"),
        instructions: "",
      },
      extractionJsonSchema: {},
    });
  });

  it("returns no profile for unknown extraction profiles", async () => {
    const repository = createExtractionProfileRepository();

    await expect(repository.getById("experimental").toPromise()).resolves.toBeUndefined();
  });
});

function createExtractionProfileRepository() {
  return new ExtractionProfileStaticRepository({
    provider: "stub",
    model: "stub-model",
  });
}
