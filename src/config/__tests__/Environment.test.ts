import { describe, expect, it } from "vitest";

import { getEnvironment, getLlmConfiguration } from "../Environment.js";

describe("getEnvironment", () => {
  it("parses LLM and PDF defaults", () => {
    expect(getEnvironment({})).toMatchObject({
      LLM_PROVIDER: "stub",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1",
      OLLAMA_MODEL: "qwen3-vl:4b",
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

  it("maps the selected provider to its extraction profile and connection settings", () => {
    expect(
      getLlmConfiguration(
        getEnvironment({
          LLM_PROVIDER: "ollama",
          OLLAMA_API_KEY: "local-key",
          OLLAMA_BASE_URL: "http://ollama.test/v1",
          OLLAMA_MODEL: "llava:latest",
        }),
      ),
    ).toMatchObject({
      profile: { provider: "ollama", model: "llava:latest" },
      ollama: { apiKey: "local-key", baseUrl: "http://ollama.test/v1" },
      openRouter: { baseUrl: "https://openrouter.ai/api/v1" },
    });
  });
});
