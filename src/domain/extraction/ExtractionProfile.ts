import { z } from "zod";

import type { JsonObject } from "../entities/generic/Json.js";

/** An opaque identifier resolved by the infrastructure extraction-service factory. */
export type ExtractionProvider = string;

export const extractionProfileNames = ["default"] as const;
export const extractionProfileNameSchema = z.enum(extractionProfileNames);
export type ExtractionProfileName = z.infer<typeof extractionProfileNameSchema>;

export function isExtractionProfileName(value: string): value is ExtractionProfileName {
  return extractionProfileNameSchema.safeParse(value).success;
}

export type ExtractionProfilePrompt = {
  readonly system: string;
  readonly userTemplate: string;
  readonly instructions: string;
};

export type ExtractionProfileTemplate = {
  readonly id: ExtractionProfileName;
  readonly provider: ExtractionProvider;
  readonly model: string;
  readonly prompt: ExtractionProfilePrompt;
  readonly extractionJsonSchema: JsonObject;
};

export type ExtractionProfile = ExtractionProfileTemplate & {
  readonly formType: string;
};
