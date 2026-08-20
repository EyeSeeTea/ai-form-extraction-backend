import { ValidationError } from "../errors/ValidationError.js";
import { Future } from "../entities/generic/Future.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractionProfileRepository } from "../repositories/ExtractionProfileRepository.js";
import type { ExtractionProfile, ExtractionProfileName } from "./ExtractionProfile.js";
import { buildDefaultExtractionInstructions } from "./PromptComposer.js";

export interface ManagedExtractionProfileResolver {
  resolve(profile: ExtractionProfileName, formType: string): Future<Error, ExtractionProfile>;
}

export class DefaultManagedExtractionProfileResolver implements ManagedExtractionProfileResolver {
  constructor(private readonly extractionProfileRepository: ExtractionProfileRepository) {}

  resolve(profile: ExtractionProfileName, formType: string): Future<Error, ExtractionProfile> {
    const formDefinition = getFormDefinition(formType);
    if (!formDefinition) {
      return Future.error(new ValidationError(`Unknown form type: ${formType}`));
    }

    return this.extractionProfileRepository.getById(profile).flatMap((baseProfile) => {
      if (!baseProfile) {
        return Future.error(new ValidationError(`Unknown extraction profile: ${profile}`));
      }

      return Future.success({
        ...baseProfile,
        formType: formDefinition.formType,
        prompt: {
          ...baseProfile.prompt,
          instructions: buildDefaultExtractionInstructions(formDefinition.formType),
        },
        extractionJsonSchema: formDefinition.extractionJsonSchema,
      });
    });
  }
}
