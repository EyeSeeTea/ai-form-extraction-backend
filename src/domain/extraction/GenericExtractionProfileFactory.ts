import type { JsonObject } from "../entities/generic/Json.js";
import type { ExtractionProfileRepository } from "../repositories/ExtractionProfileRepository.js";
import type { ExtractionProfile, ExtractionProfileName } from "./ExtractionProfile.js";

export type CreateGenericExtractionProfileInput = {
  readonly profile: ExtractionProfileName;
  readonly form: string;
  readonly instructions: string;
  readonly extractionJsonSchema: JsonObject;
};

export interface GenericExtractionProfileFactory {
  create(input: CreateGenericExtractionProfileInput): ExtractionProfile;
}

export class DefaultGenericExtractionProfileFactory implements GenericExtractionProfileFactory {
  constructor(private readonly extractionProfileRepository: ExtractionProfileRepository) {}

  create(input: CreateGenericExtractionProfileInput): ExtractionProfile {
    const baseProfile = this.extractionProfileRepository.getById(input.profile);

    return {
      ...baseProfile,
      formType: input.form,
      prompt: {
        ...baseProfile.prompt,
        instructions: input.instructions,
      },
      extractionJsonSchema: input.extractionJsonSchema,
    };
  }
}
