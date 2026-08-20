import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";

import { Future } from "../../domain/entities/generic/Future.js";
import type { JsonObject } from "../../domain/entities/generic/Json.js";
import {
  FormExtractionConfigurationError,
  FormExtractionResponseError,
} from "../../domain/services/FormExtractionErrors.js";
import type {
  FormExtractionService,
  FormExtractionServiceInput,
  FormExtractionServiceOutput,
  FormExtractionServiceUsage,
} from "../../domain/services/FormExtractionService.js";

export type OpenAiCompatibleFormExtractionServiceConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly providerName: string;
  readonly providerDisplayName: string;
  readonly includeCost: boolean;
};

export type OpenAiCompatibleChatCompletionRequest = {
  readonly model: string;
  readonly messages: OpenAiCompatibleChatMessage[];
  readonly response_format: {
    readonly type: "json_object";
  };
  readonly temperature: 0;
  readonly stream: false;
};

type OpenAiCompatibleChatMessage =
  | {
      readonly role: "system";
      readonly content: string;
    }
  | {
      readonly role: "user";
      readonly content: OpenAiCompatibleUserContentPart[];
    };

type OpenAiCompatibleUserContentPart =
  | {
      readonly type: "text";
      readonly text: string;
    }
  | {
      readonly type: "image_url";
      readonly image_url: {
        readonly url: string;
      };
    };

type OpenAiCompatibleChatCompletionResponse = {
  readonly id?: string;
  readonly choices: readonly {
    readonly message?: {
      readonly content?: string | null;
    };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
    readonly cost?: number;
  };
};

export class OpenAiCompatibleFormExtractionService implements FormExtractionService {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAiCompatibleFormExtractionServiceConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput> {
    return Future.fromComputation((resolve, reject) => {
      const abortController = new AbortController();

      void this.client.chat.completions
        .create(this.buildRequest(input), {
          signal: abortController.signal,
        })
        .then((response) => {
          const content = response.choices[0]?.message.content;

          if (!content) {
            throw new FormExtractionResponseError(
              `${this.config.providerDisplayName} response did not include message content`,
            );
          }

          resolve({
            providerName: this.config.providerName,
            model: this.config.model,
            extractedFields: parseJsonObject(content, this.config.providerDisplayName),
            warnings: [],
            ...(response.usage ? { usage: mapUsage(response.usage, this.config.includeCost) } : {}),
            ...(response.id ? { rawResponseId: response.id } : {}),
          });
        })
        .catch((error: unknown) => {
          reject(normalizeOpenAiCompatibleError(error));
        });

      return () => {
        abortController.abort();
      };
    });
  }

  private buildRequest(input: FormExtractionServiceInput): OpenAiCompatibleChatCompletionRequest {
    return {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: input.prompt.system,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: input.prompt.userText,
            },
            ...input.images.map((image) => ({
              type: "image_url" as const,
              image_url: {
                url: toDataUrl(image.mediaType, image.bytes),
              },
            })),
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      stream: false,
    };
  }
}

function toDataUrl(mediaType: string, bytes: Uint8Array): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function parseJsonObject(content: string, providerName: string): JsonObject {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new FormExtractionResponseError(
      `${providerName} response content was not valid JSON`,
      error,
    );
  }

  if (!isJsonObject(parsed)) {
    throw new FormExtractionResponseError(`${providerName} response content was not a JSON object`);
  }

  return parsed;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapUsage(
  usage: NonNullable<OpenAiCompatibleChatCompletionResponse["usage"]>,
  includeCost: boolean,
): FormExtractionServiceUsage {
  return {
    ...(usage.prompt_tokens !== undefined ? { inputTokens: usage.prompt_tokens } : {}),
    ...(usage.completion_tokens !== undefined ? { outputTokens: usage.completion_tokens } : {}),
    ...(usage.total_tokens !== undefined ? { totalTokens: usage.total_tokens } : {}),
    ...(includeCost && usage.cost !== undefined ? { costUsd: usage.cost } : {}),
  };
}

function normalizeOpenAiCompatibleError(error: unknown): Error {
  if (
    error instanceof FormExtractionResponseError ||
    error instanceof FormExtractionConfigurationError
  ) {
    return error;
  }

  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError ||
    error instanceof BadRequestError
  ) {
    return new FormExtractionConfigurationError(error.message, error);
  }

  if (
    error instanceof RateLimitError ||
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIConnectionError
  ) {
    return error;
  }

  if (error instanceof APIError) {
    if (error.status === 401 || error.status === 403 || error.status === 400) {
      return new FormExtractionConfigurationError(error.message, error);
    }

    return error;
  }

  return error instanceof Error ? error : new Error(String(error));
}
