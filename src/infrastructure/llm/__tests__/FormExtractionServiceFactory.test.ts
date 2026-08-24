import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractionProfile } from "../../../domain/extraction/ExtractionProfile.js";
import type { PreparedImage } from "../../../domain/services/DocumentPreparationService.js";
import { FormExtractionConfigurationError } from "../../../domain/services/FormExtractionErrors.js";
import type { OpenRouterChatCompletionRequest } from "../OpenRouterFormExtractionService.js";
import { DefaultFormExtractionServiceFactory } from "../DefaultFormExtractionServiceFactory.js";

const openAiMock = vi.hoisted(() => {
  const create = vi.fn(async (request: OpenRouterChatCompletionRequest): Promise<unknown> => {
    void request;
    return undefined;
  });
  const OpenAI = vi.fn(function OpenAI(config: unknown) {
    void config;
    return {
      chat: {
        completions: {
          create,
        },
      },
    };
  });

  class APIError extends Error {
    constructor(
      message: string,
      readonly status?: number,
    ) {
      super(message);
    }
  }

  return {
    OpenAI,
    create,
    APIError,
    APIConnectionError: class APIConnectionError extends Error {},
    APIConnectionTimeoutError: class APIConnectionTimeoutError extends Error {},
    AuthenticationError: class AuthenticationError extends Error {},
    BadRequestError: class BadRequestError extends Error {},
    PermissionDeniedError: class PermissionDeniedError extends Error {},
    RateLimitError: class RateLimitError extends Error {},
  };
});

vi.mock("openai", () => ({
  default: openAiMock.OpenAI,
  APIConnectionError: openAiMock.APIConnectionError,
  APIConnectionTimeoutError: openAiMock.APIConnectionTimeoutError,
  APIError: openAiMock.APIError,
  AuthenticationError: openAiMock.AuthenticationError,
  BadRequestError: openAiMock.BadRequestError,
  PermissionDeniedError: openAiMock.PermissionDeniedError,
  RateLimitError: openAiMock.RateLimitError,
}));

describe("DefaultFormExtractionServiceFactory", () => {
  beforeEach(() => {
    openAiMock.OpenAI.mockClear();
    openAiMock.create.mockReset();
  });

  it("creates a stub service without external credentials", async () => {
    const factory = new DefaultFormExtractionServiceFactory({
      openRouter: {
        baseUrl: "https://openrouter.test/api/v1",
      },
    });

    const service = factory.create(
      createProfile({
        provider: "stub",
        model: "stub-eval-model",
        extractionJsonSchema: {
          type: "object",
          properties: { answer: { type: "boolean" } },
        },
      }),
    );
    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      providerName: "stub",
      model: "stub-eval-model",
      extractedFields: { answer: true },
    });
    expect(openAiMock.OpenAI).not.toHaveBeenCalled();
  });

  it("requires an OpenRouter API key for openrouter profiles", () => {
    const factory = new DefaultFormExtractionServiceFactory({
      openRouter: {
        baseUrl: "https://openrouter.test/api/v1",
      },
    });

    expect(() => factory.create(createProfile({ provider: "openrouter" }))).toThrow(
      FormExtractionConfigurationError,
    );
  });

  it("creates an Ollama service with the configured local endpoint and profile model", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ result: { country: "Kenya" }, fieldConfidence: {} }),
          },
        },
      ],
      usage: { cost: 0.001 },
    });
    const factory = new DefaultFormExtractionServiceFactory({
      ollama: {
        apiKey: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
      },
    });

    const service = factory.create(createProfile({ provider: "ollama", model: "qwen3-vl:4b" }));
    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      providerName: "ollama",
      model: "qwen3-vl:4b",
      extractedFields: { country: "Kenya" },
      usage: {},
    });

    expect(openAiMock.OpenAI).toHaveBeenCalledWith({
      apiKey: "ollama",
      baseURL: "http://127.0.0.1:11434/v1",
    });
    expect(openAiMock.create.mock.calls[0]?.[0]).toMatchObject({
      model: "qwen3-vl:4b",
    });
  });

  it("creates an OpenRouter service with environment credentials and the profile model", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ result: { country: "Kenya" }, fieldConfidence: {} }),
          },
        },
      ],
      usage: { cost: 0.001 },
    });
    const factory = new DefaultFormExtractionServiceFactory({
      openRouter: {
        apiKey: "test-key",
        baseUrl: "https://openrouter.test/api/v1",
      },
    });

    const service = factory.create(
      createProfile({ provider: "openrouter", model: "openrouter:test-model" }),
    );
    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      providerName: "openrouter",
      model: "openrouter:test-model",
      extractedFields: { country: "Kenya" },
      usage: { costUsd: 0.001 },
    });

    expect(openAiMock.OpenAI).toHaveBeenCalledWith({
      apiKey: "test-key",
      baseURL: "https://openrouter.test/api/v1",
    });
    expect(openAiMock.create.mock.calls[0]?.[0]).toMatchObject({
      model: "openrouter:test-model",
    });
  });
});

function createProfile(
  overrides: Partial<ExtractionProfile> & Pick<ExtractionProfile, "provider">,
): ExtractionProfile {
  return {
    id: "default",
    formType: "end-of-season",
    model: overrides.model ?? "stub-model",
    prompt: {
      system: "System prompt",
      userTemplate: "Form type: {{formType}}",
      instructions: "Instructions",
    },
    extractionJsonSchema: {
      type: "object",
    },
    ...overrides,
  };
}

function createInput() {
  return {
    formType: "end-of-season",
    prompt: {
      system: "System prompt",
      userText: "User prompt",
    },
    images: [preparedImage()],
    model: "ignored-input-model",
    includeFieldConfidence: true,
  };
}

function preparedImage(): PreparedImage {
  return {
    pageNumber: 1,
    mediaType: "image/jpeg",
    bytes: new Uint8Array([1, 2, 3, 4]),
    source: {
      storageKey: "bundle/001.jpg",
      sha256: "hash",
    },
  };
}
