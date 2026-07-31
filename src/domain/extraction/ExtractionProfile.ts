import { z } from "zod";

import type { JsonObject } from "../entities/generic/Json.js";

export type ExtractionProvider = "stub" | "openrouter" | "ollama";

export const extractionProfileNames = ["default"] as const;
export const extractionProfileNameSchema = z.enum(extractionProfileNames);
export type ExtractionProfileName = z.infer<typeof extractionProfileNameSchema>;

export function isExtractionProfileName(value: string): value is ExtractionProfileName {
  return extractionProfileNameSchema.safeParse(value).success;
}

export type ExtractionProfilePrompt = Readonly<{
  system: string;
  userTemplate: string;
  instructions: string;
}>;

export type ExtractionProfileTemplate = Readonly<{
  id: ExtractionProfileName;
  provider: ExtractionProvider;
  model: string;
  prompt: ExtractionProfilePrompt;
  extractionJsonSchema: JsonObject;
}>;

export type ExtractionProfile = ExtractionProfileTemplate &
  Readonly<{
    formType: string;
  }>;
