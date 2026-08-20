import type { Future } from "../entities/generic/Future.js";
import type { PreparedImage } from "./DocumentPreparationService.js";
import type { JsonValue } from "../entities/generic/Json.js";

export type FormExtractionPrompt = Readonly<{
  system: string;
  userText: string;
}>;

export type FormExtractionServiceInput = Readonly<{
  formType: string;
  prompt: FormExtractionPrompt;
  images: PreparedImage[];
  model: string;
}>;

export type FormExtractionServiceUsage = Readonly<{
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}>;

export type FormExtractionServiceOutput<ExtractedFields extends JsonValue = JsonValue> = Readonly<{
  providerName: string;
  model: string;
  extractedFields: ExtractedFields;
  fieldConfidence?: JsonValue;
  warnings: string[];
  usage?: FormExtractionServiceUsage;
  rawResponseId?: string;
}>;

export interface FormExtractionService {
  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput>;
}
