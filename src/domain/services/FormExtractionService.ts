import type { Future } from "../entities/generic/Future.js";
import type { JsonObject } from "../entities/Job.js";
import type { PreparedImage } from "./DocumentPreparationService.js";

export type FormExtractionServiceInput = {
  readonly formType: string;
  readonly jsonSchema: JsonObject;
  readonly images: PreparedImage[];
  readonly instructions: string;
  readonly model: string;
};

export type FormExtractionServiceUsage = {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly costUsd?: number;
};

export type FormExtractionServiceOutput<ExtractedFields extends JsonObject = JsonObject> = {
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
