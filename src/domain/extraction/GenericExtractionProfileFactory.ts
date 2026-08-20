import type { JsonObject } from "../entities/generic/Json.js";
import { Future } from "../entities/generic/Future.js";
import { ValidationError } from "../errors/ValidationError.js";
import type { ExtractionProfileRepository } from "../repositories/ExtractionProfileRepository.js";
import type { ExtractionProfile, ExtractionProfileName } from "./ExtractionProfile.js";

export type CreateGenericExtractionProfileInput = {
  readonly profile: ExtractionProfileName;
  readonly form: string;
  readonly instructions: string;
  readonly extractionJsonSchema: JsonObject;
};

export interface GenericExtractionProfileFactory {
  create(input: CreateGenericExtractionProfileInput): Future<Error, ExtractionProfile>;
}

export class DefaultGenericExtractionProfileFactory implements GenericExtractionProfileFactory {
  constructor(private readonly extractionProfileRepository: ExtractionProfileRepository) {}

  create(input: CreateGenericExtractionProfileInput): Future<Error, ExtractionProfile> {
    return this.extractionProfileRepository.getById(input.profile).flatMap((baseProfile) => {
      if (!baseProfile) {
        return Future.error(new ValidationError(`Unknown extraction profile: ${input.profile}`));
      }

      return Future.success({
        ...baseProfile,
        formType: input.form,
        prompt: {
          ...baseProfile.prompt,
          instructions: input.instructions,
        },
        extractionJsonSchema: input.extractionJsonSchema,
      });
    });
  }
}
