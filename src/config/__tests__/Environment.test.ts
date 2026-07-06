import { describe, expect, it } from "vitest";

import { getEnvironment } from "../Environment.js";

describe("getEnvironment", () => {
  it("parses LLM and PDF defaults", () => {
    expect(getEnvironment({})).toMatchObject({
      LLM_PROVIDER: "stub",
      OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
      OPENROUTER_MODEL: "qwen/qwen3-vl-32b-instruct",
      PDF_MAX_PAGES: 20,
      PDF_MAX_EXTRACTED_IMAGES: 20,
    });
  });

  it("requires an OpenRouter API key when OpenRouter is selected", () => {
    expect(() =>
      getEnvironment({
        LLM_PROVIDER: "openrouter",
      }),
    ).toThrow("OPENROUTER_API_KEY must be set when LLM_PROVIDER=openrouter");
  });
});
