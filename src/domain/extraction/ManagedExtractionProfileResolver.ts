import { ValidationError } from "../../shared/ValidationError.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractionProfileRepository } from "../repositories/ExtractionProfileRepository.js";
import type { ExtractionProfile, ExtractionProfileName } from "./ExtractionProfile.js";
import { buildDefaultExtractionInstructions } from "./PromptComposer.js";

export interface ManagedExtractionProfileResolver {
  resolve(profile: ExtractionProfileName, formType: string): ExtractionProfile;
}

export class DefaultManagedExtractionProfileResolver implements ManagedExtractionProfileResolver {
  constructor(private readonly extractionProfileRepository: ExtractionProfileRepository) {}

  resolve(profile: ExtractionProfileName, formType: string): ExtractionProfile {
    const formDefinition = getFormDefinition(formType);
    if (!formDefinition) {
      throw new ValidationError(`Unknown form type: ${formType}`);
    }

    const baseProfile = this.extractionProfileRepository.getById(profile);

    return {
      ...baseProfile,
      formType: formDefinition.formType,
      prompt: {
        ...baseProfile.prompt,
        instructions: buildDefaultExtractionInstructions(formDefinition.formType),
      },
      extractionJsonSchema: formDefinition.extractionJsonSchema,
    };
  }
}
