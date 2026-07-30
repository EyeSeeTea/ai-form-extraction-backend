import { describe, expect, it } from "vitest";

import { ExtractionProfileStaticRepository } from "../../../data/repositories/ExtractionProfileStaticRepository.js";
import { ValidationError } from "../../../shared/ValidationError.js";
import { endOfSeasonFormDefinition } from "../../forms/end-of-season/EndOfSeasonFormDefinition.js";
import { DefaultManagedExtractionProfileResolver } from "../ManagedExtractionProfileResolver.js";
import { composePrompt } from "../PromptComposer.js";

describe("DefaultManagedExtractionProfileResolver", () => {
  it("returns the default effective model, schema, and prompt for a registered form", () => {
    const resolver = createManagedExtractionProfileResolver();

    const profile = resolver.resolve("default", "end-of-season");

    expect(profile).toMatchObject({
      id: "default",
      formType: "end-of-season",
      provider: "stub",
      model: "stub-model",
      extractionJsonSchema: endOfSeasonFormDefinition.extractionJsonSchema,
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
      },
    });
    expect(profile.prompt.instructions).toContain(
      "Extract structured fields from the provided end-of-season form images.",
    );
    expect(profile.prompt.instructions).toContain(
      "Return a single JSON object that matches the provided JSON Schema.",
    );
    expect(profile.prompt.instructions).toContain(
      "Do not include markdown, commentary, or additional wrapper keys.",
    );

    expect(composePrompt(profile, { includeFieldConfidence: true })).toMatchObject({
      system:
        "You extract structured data from form images. Return only one valid JSON object and no markdown.",
    });
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).toContain(
      "Form type: end-of-season",
    );
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).toContain(
      `Canonical JSON Schema: ${JSON.stringify(endOfSeasonFormDefinition.extractionJsonSchema)}`,
    );
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).toContain(
      "Extraction instructions:",
    );
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).toContain(
      "Return a single JSON object that matches the provided JSON Schema.",
    );
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).toContain(
      "Do not include markdown, commentary, or additional wrapper keys.",
    );
  });

  it("fails clearly for unknown form types", () => {
    const resolver = createManagedExtractionProfileResolver();

    expect(() => resolver.resolve("default", "missing")).toThrow(ValidationError);
    expect(() => resolver.resolve("default", "missing")).toThrow("Unknown form type: missing");
  });
});

function createManagedExtractionProfileResolver() {
  return new DefaultManagedExtractionProfileResolver(
    new ExtractionProfileStaticRepository({
      provider: "stub",
      model: "stub-model",
    }),
  );
}
