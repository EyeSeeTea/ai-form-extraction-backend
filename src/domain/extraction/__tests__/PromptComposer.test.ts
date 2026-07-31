import { describe, expect, it } from "vitest";

import { composePrompt } from "../PromptComposer.js";

describe("composePrompt", () => {
  it("interpolates form type, JSON schema, and instructions into the user prompt", () => {
    const prompt = composePrompt({
      formType: "end-of-season",
      extractionJsonSchema: {
        type: "object",
        required: ["country"],
      },
      prompt: {
        system: "System prompt",
        userTemplate: [
          "Form type: {{formType}}",
          "Schema: {{jsonSchema}}",
          "Instructions: {{instructions}}",
        ].join("\n"),
        instructions: "Return exact labels",
      },
    });

    expect(prompt).toEqual({
      system: "System prompt",
      userText: [
        "Form type: end-of-season",
        'Schema: {"type":"object","required":["country"]}',
        "Instructions: Return exact labels",
      ].join("\n"),
    });
  });
});
