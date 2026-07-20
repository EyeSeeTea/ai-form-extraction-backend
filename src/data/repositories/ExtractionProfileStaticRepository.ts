import { ValidationError } from "../../shared/ValidationError.js";
import type { ExtractionProfileRepository } from "../../domain/repositories/ExtractionProfileRepository.js";
import {
  extractionProfileNames,
  isExtractionProfileName,
  type ExtractionProvider,
  type ExtractionProfileName,
  type ExtractionProfileTemplate,
} from "../../domain/extraction/ExtractionProfile.js";
import {
  managedExtractionSystemPrompt,
  managedExtractionUserPromptTemplate,
} from "../../domain/extraction/PromptComposer.js";

export type ExtractionProfileStaticRepositoryConfig = Readonly<{
  provider: ExtractionProvider;
  model: string;
}>;

export class ExtractionProfileStaticRepository implements ExtractionProfileRepository {
  private readonly profileNames = extractionProfileNames;

  constructor(private readonly config: ExtractionProfileStaticRepositoryConfig) {}

  list(): readonly ExtractionProfileName[] {
    return this.profileNames;
  }

  getById(id: string): ExtractionProfileTemplate {
    if (!isExtractionProfileName(id)) {
      throw new ValidationError(`Unknown extraction profile: ${id}`);
    }

    return {
      id,
      provider: this.config.provider,
      model: this.config.model,
      prompt: {
        system: managedExtractionSystemPrompt,
        userTemplate: managedExtractionUserPromptTemplate,
        instructions: "",
      },
      extractionJsonSchema: {},
    };
  }
}
