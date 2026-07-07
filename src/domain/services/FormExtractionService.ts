import type { Future } from "../entities/generic/Future.js";
import type { PreparedImage } from "./DocumentPreparationService.js";
import type { JsonValue } from "../entities/generic/Json.js";

export type FormExtractionPrompt = {
  readonly system: string;
  readonly userText: string;
};

export type FormExtractionServiceInput = {
  readonly formType: string;
  readonly prompt: FormExtractionPrompt;
  readonly images: PreparedImage[];
  readonly model: string;
};

export type FormExtractionServiceUsage = {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly costUsd?: number;
};

export type FormExtractionServiceOutput<ExtractedFields extends JsonValue = JsonValue> = {
  readonly providerName: string;
  readonly model: string;
  readonly extractedFields: ExtractedFields;
  readonly warnings: string[];
  readonly usage?: FormExtractionServiceUsage;
  readonly rawResponseId?: string;
};

export interface FormExtractionService {
  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput>;
}
