import type { JsonObject } from "../entities/generic/Json.js";

export type ExtractionProvider = "stub" | "openrouter";

export type ExtractionProfile = {
  readonly id: string;
  readonly formType: string;
  readonly provider: ExtractionProvider;
  readonly model: string;
  readonly prompt: {
    readonly system: string;
    readonly userTemplate: string;
    readonly instructions: string;
  };
  readonly extractionJsonSchema: JsonObject;
};
