import { Future } from "../../domain/entities/generic/Future.js";
import type { ExtractionProfileRepository } from "../../domain/repositories/ExtractionProfileRepository.js";
import type { Maybe } from "../../utils/ts-utils.js";
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

  list(): Future<Error, readonly ExtractionProfileName[]> {
    return Future.success(this.profileNames);
  }

  getById(id: string): Future<Error, Maybe<ExtractionProfileTemplate>> {
    if (!isExtractionProfileName(id)) {
      return Future.success(undefined);
    }

    return Future.success({
      id,
      provider: this.config.provider,
      model: this.config.model,
      prompt: {
        system: managedExtractionSystemPrompt,
        userTemplate: managedExtractionUserPromptTemplate,
        instructions: "",
      },
      extractionJsonSchema: {},
    });
  }
}
