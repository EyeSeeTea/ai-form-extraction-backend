import { describe, expect, it } from "vitest";

import { ValidationError } from "../../../shared/ValidationError.js";
import { endOfSeasonFormDefinition } from "../../forms/end-of-season/EndOfSeasonFormDefinition.js";
import { composePrompt } from "../PromptComposer.js";
import { DefaultExtractionProfileResolver } from "../ExtractionProfileResolver.js";

describe("DefaultExtractionProfileResolver", () => {
  it("returns the default effective model, schema, and prompt for a registered form", () => {
    const resolver = createResolver();

    const profile = resolver.resolve("end-of-season");

    expect(profile).toMatchObject({
      id: "default:end-of-season",
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
          "Extraction instructions: {{instructions}}",
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

    expect(composePrompt(profile)).toMatchObject({
      system:
        "You extract structured data from form images. Return only one valid JSON object and no markdown.",
    });
    expect(composePrompt(profile).userText).toContain("Form type: end-of-season");
    expect(composePrompt(profile).userText).toContain(
      `Canonical JSON Schema: ${JSON.stringify(endOfSeasonFormDefinition.extractionJsonSchema)}`,
    );
    expect(composePrompt(profile).userText).toContain("Extraction instructions:");
    expect(composePrompt(profile).userText).toContain(
      "Return a single JSON object that matches the provided JSON Schema.",
    );
    expect(composePrompt(profile).userText).toContain(
      "Do not include markdown, commentary, or additional wrapper keys.",
    );
  });

  it("fails clearly for unknown form types", () => {
    const resolver = createResolver();

    expect(() => resolver.resolve("missing")).toThrow(ValidationError);
    expect(() => resolver.resolve("missing")).toThrow("Unknown form type: missing");
  });
});

function createResolver() {
  return new DefaultExtractionProfileResolver({
    provider: "stub",
    model: "stub-model",
  });
}
