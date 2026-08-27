import { describe, expect, it } from "vitest";

import {
  composePrompt,
  managedExtractionSystemPrompt,
  managedExtractionUserPromptTemplate,
} from "../PromptComposer.js";

describe("composePrompt", () => {
  it("defines the managed prompt policy for evidence-only extraction and blank fields", () => {
    expect(managedExtractionSystemPrompt).toContain(
      "use only information visibly present in the form images; do not invent or guess values.",
    );
    expect(managedExtractionSystemPrompt).toContain(
      "omit fields that are blank, unavailable, unchecked, or not applicable.",
    );

    const prompt = composePrompt(
      {
        formType: "end-of-season",
        extractionJsonSchema: { type: "object" },
        prompt: {
          system: managedExtractionSystemPrompt,
          userTemplate: managedExtractionUserPromptTemplate,
          instructions: "Extract visible values",
        },
      },
      { includeFieldConfidence: false },
    );

    expect(prompt.userText).toContain("Extraction response JSON Schema:");
    expect(prompt.userText).not.toContain("Canonical JSON Schema:");
  });

  it("interpolates form type and instructions into the user prompt", () => {
    const prompt = composePrompt(
      {
        formType: "end-of-season",
        extractionJsonSchema: {
          type: "object",
          required: ["country"],
        },
        prompt: {
          system: "System prompt",
          userTemplate: ["Form type: {{formType}}", "Instructions: {{instructions}}"].join("\n"),
          instructions: "Return exact labels",
        },
      },
      { includeFieldConfidence: true },
    );

    expect(prompt).toEqual({
      system: "System prompt",
      userText: ["Form type: end-of-season", "Instructions: Return exact labels"].join("\n"),
    });
  });

  it("adds a model-only response envelope without changing the result schema", () => {
    const prompt = composePrompt(
      {
        formType: "caller-label",
        extractionJsonSchema: {
          type: "object",
          properties: { country: { type: "string" } },
        },
        prompt: {
          system: "System prompt",
          userTemplate: "{{responseJsonSchema}}",
          instructions: "Return exact labels",
        },
      },
      { includeFieldConfidence: true },
    );

    expect(prompt.userText).toContain('"result":{"type":"object"');
    expect(prompt.userText).toContain('"fieldConfidence"');
    expect(prompt.userText).toContain('"minimum":0');
    expect(prompt.userText).toContain('"maximum":1');
  });

  it("omits field-confidence instructions and schema when confidence is disabled", () => {
    const prompt = composePrompt(
      {
        formType: "caller-label",
        extractionJsonSchema: {
          type: "object",
          properties: { country: { type: "string" } },
        },
        prompt: {
          system: "System prompt",
          userTemplate: "{{responseJsonSchema}}",
          instructions: "Return exact labels",
        },
      },
      { includeFieldConfidence: false },
    );

    expect(prompt.userText).toContain('"required":["result"]');
    expect(prompt.userText).not.toContain('"fieldConfidence"');
  });
});
