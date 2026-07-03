import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PreparedImage } from "../../../domain/services/DocumentPreparationService.js";
import { FormExtractionResponseError } from "../../../domain/services/FormExtractionErrors.js";
import {
  OpenRouterFormExtractionService,
  type OpenRouterChatCompletionRequest,
} from "../OpenRouterFormExtractionService.js";

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

describe("OpenRouterFormExtractionService", () => {
  beforeEach(() => {
    openAiMock.OpenAI.mockClear();
    openAiMock.create.mockReset();
  });

  it("sends the configured model, JSON contract, schema, instructions, and image data URLs", async () => {
    openAiMock.create.mockResolvedValueOnce({
      id: "response-1",
      choices: [{ message: { content: JSON.stringify({ country: "Kenya" }) } }],
    });
    const service = createService();

    await expect(service.extract(createInput()).toPromise()).resolves.toMatchObject({
      providerName: "openrouter",
      model: "openrouter:test-model",
      extractedFields: { country: "Kenya" },
      rawResponseId: "response-1",
    });

    expect(openAiMock.OpenAI).toHaveBeenCalledWith({
      apiKey: "test-key",
      baseURL: "https://openrouter.test/api/v1",
    });

    const request = openAiMock.create.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "openrouter:test-model",
      response_format: { type: "json_object" },
      temperature: 0,
      stream: false,
    });
    expect(request?.messages[0]).toMatchObject({
      role: "system",
    });
    expect(request?.messages[1]).toMatchObject({
      role: "user",
    });

    const userContent = request?.messages[1]?.role === "user" ? request.messages[1].content : [];
    expect(userContent[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining('"required":["country"]') as string,
    });
    expect(userContent[0]).toMatchObject({
      text: expect.stringContaining("Use exact labels") as string,
    });
    expect(userContent[1]).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,AQIDBA==",
      },
    });
  });

  it("maps usage from the provider response", async () => {
    openAiMock.create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ country: "Kenya" }) } }],
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

function createService() {
  return new OpenRouterFormExtractionService({
    apiKey: "test-key",
    baseUrl: "https://openrouter.test/api/v1",
    model: "openrouter:test-model",
  });
}

function createInput() {
  return {
    formType: "end-of-season",
    jsonSchema: {
      type: "object",
      required: ["country"],
      properties: {
        country: { type: "string" },
      },
    },
    images: [preparedImage()],
    instructions: "Use exact labels",
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
