import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PreparedImage } from "../../../domain/services/DocumentPreparationService.js";
import { FormExtractionResponseError } from "../../../domain/services/FormExtractionErrors.js";
import {
  OpenAiCompatibleFormExtractionService,
  type OpenAiCompatibleChatCompletionRequest,
  type OpenAiCompatibleFormExtractionServiceConfig,
} from "../OpenAiCompatibleFormExtractionService.js";

const openAiMock = vi.hoisted(() => {
  const create = vi.fn(
    async (
      request: OpenAiCompatibleChatCompletionRequest,
      _options?: unknown,
    ): Promise<unknown> => {
      void request;
      void _options;
      return undefined;
    },
  );
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

describe("OpenAiCompatibleFormExtractionService", () => {
  beforeEach(() => {
    openAiMock.OpenAI.mockClear();
    openAiMock.create.mockReset();
  });

  it("passes through the provided prompt and image data URLs", async () => {
    openAiMock.create.mockResolvedValueOnce({
      id: "response-1",
      choices: [
        {
          message: {
            content: JSON.stringify({ result: { country: "Kenya" }, fieldConfidence: {} }),
          },
        },
      ],
    });
    const service = createService();

    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      providerName: "test-provider",
      model: "test-model",
      extractedFields: { country: "Kenya" },
      rawResponseId: "response-1",
    });

    expect(openAiMock.OpenAI).toHaveBeenCalledWith({
      apiKey: "test-key",
      baseURL: "https://provider.test/v1",
    });
    const requestOptions = getRequestOptions(openAiMock.create.mock.calls[0]);
    expect(hasAbortSignal(requestOptions)).toBe(true);

    const request = getRequest(openAiMock.create.mock.calls[0]);
    expect(request).toMatchObject({
      model: "test-model",
      response_format: { type: "json_object" },
      temperature: 0,
      stream: false,
    });
    expect(request?.messages[0]).toMatchObject({
      role: "system",
      content: "System prompt from use case",
    });
    expect(request?.messages[1]).toMatchObject({
      role: "user",
    });

    const userContent = request?.messages[1]?.role === "user" ? request.messages[1].content : [];
    expect(userContent[0]).toMatchObject({
      type: "text",
      text: "User prompt from use case",
    });
    expect(userContent[1]).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,AQIDBA==",
      },
    });
  });

  it("unwraps the extraction-response envelope and preserves its confidence map", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              result: { country: "Kenya" },
              fieldConfidence: { "/result/country": 0.8 },
            }),
          },
        },
      ],
    });

    await expect(createService().extract(createInput()).toPromise()).resolves.toMatchObject({
      extractedFields: { country: "Kenya" },
      fieldConfidence: { "/country": 0.8 },
    });
  });

  it("maps usage from the provider response", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ result: { country: "Kenya" }, fieldConfidence: {} }),
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        cost: 0.001,
      },
    });
    const service = createService();

    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: 0.001,
      },
    });
  });

  it("omits provider cost when disabled by the adapter configuration", async () => {
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
    const service = createService({
      providerName: "ollama",
      providerDisplayName: "Ollama",
      includeCost: false,
    });

    const output = await service.extract(createInput()).toPromise();

    expect(output.usage).toEqual({});
  });

  it("returns a deterministic response error for invalid JSON responses", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });
    const service = createService();

    await expect(service.extract(createInput()).toPromise()).rejects.toBeInstanceOf(
      FormExtractionResponseError,
    );
  });

  it("returns a deterministic response error for JSON array responses", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [{ message: { content: "[]" } }],
    });
    const service = createService();

    await expect(service.extract(createInput()).toPromise()).rejects.toBeInstanceOf(
      FormExtractionResponseError,
    );
  });
});

function createService(overrides: Partial<OpenAiCompatibleFormExtractionServiceConfig> = {}) {
  return new OpenAiCompatibleFormExtractionService({
    apiKey: "test-key",
    baseUrl: "https://provider.test/v1",
    model: "test-model",
    providerName: "test-provider",
    providerDisplayName: "Test provider",
    includeCost: true,
    ...overrides,
  });
}

function createInput() {
  return {
    formType: "end-of-season",
    prompt: {
      system: "System prompt from use case",
      userText: "User prompt from use case",
    },
    images: [preparedImage()],
    model: "ignored-input-model",
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

function getRequest(
  call: readonly [OpenAiCompatibleChatCompletionRequest, unknown?] | undefined,
): OpenAiCompatibleChatCompletionRequest | undefined {
  return call?.[0];
}

function getRequestOptions(
  call: readonly [OpenAiCompatibleChatCompletionRequest, unknown?] | undefined,
): unknown {
  return call?.[1];
}

function hasAbortSignal(value: unknown): value is { signal: AbortSignal } {
  return (
    typeof value === "object" &&
    value !== null &&
    "signal" in value &&
    value.signal instanceof AbortSignal
  );
}
