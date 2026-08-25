import { describe, expect, it } from "vitest";

import { ExtractionProfileStaticRepository } from "../../../data/repositories/ExtractionProfileStaticRepository.js";
import { ValidationError } from "../../errors/ValidationError.js";
import { endOfSeasonFormDefinition } from "../../forms/end-of-season/EndOfSeasonFormDefinition.js";
import { DefaultManagedExtractionProfileResolver } from "../ManagedExtractionProfileResolver.js";
import {
  composePrompt,
  managedExtractionSystemPrompt,
  managedExtractionUserPromptTemplate,
} from "../PromptComposer.js";

describe("DefaultManagedExtractionProfileResolver", () => {
  it("returns the default effective model, schema, and prompt for a registered form", async () => {
    const resolver = createManagedExtractionProfileResolver();

    const profile = await resolver.resolve("default", "end-of-season").toPromise();

    expect(profile).toMatchObject({
      id: "default",
      formType: "end-of-season",
      provider: "stub",
      model: "stub-model",
      extractionJsonSchema: endOfSeasonFormDefinition.extractionJsonSchema,
      prompt: {
        system: managedExtractionSystemPrompt,
        userTemplate: managedExtractionUserPromptTemplate,
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
      system: managedExtractionSystemPrompt,
    });
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).toContain(
      "Form type: end-of-season",
    );
    expect(composePrompt(profile, { includeFieldConfidence: true }).userText).not.toContain(
      "Canonical JSON Schema:",
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

  it("fails clearly for unknown form types", async () => {
    const resolver = createManagedExtractionProfileResolver();

    await expect(resolver.resolve("default", "missing").toPromise()).rejects.toThrow(
      ValidationError,
    );
    await expect(resolver.resolve("default", "missing").toPromise()).rejects.toThrow(
      "Unknown form type: missing",
    );
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
