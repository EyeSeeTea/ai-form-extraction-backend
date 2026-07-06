import { FormExtractionConfigurationError } from "../../domain/services/FormExtractionErrors.js";
import type { FormExtractionServiceFactory } from "../../domain/services/FormExtractionServiceFactory.js";
import type { ExtractionProfile } from "../../domain/extraction/ExtractionProfile.js";
import type { FormExtractionService } from "../../domain/services/FormExtractionService.js";
import { OpenRouterFormExtractionService } from "./OpenRouterFormExtractionService.js";
import { StubFormExtractionService } from "./StubFormExtractionService.js";

export type DefaultFormExtractionServiceFactoryConfig = {
  readonly openRouter?: {
    readonly apiKey?: string;
    readonly baseUrl: string;
  };
};

export class DefaultFormExtractionServiceFactory implements FormExtractionServiceFactory {
  constructor(private readonly config: DefaultFormExtractionServiceFactoryConfig) {}

  create(profile: ExtractionProfile): FormExtractionService {
    if (profile.provider === "stub") {
      return new StubFormExtractionService("stub", profile.model);
    }

    const openRouter = this.config.openRouter;
    if (!openRouter?.apiKey) {
      throw new FormExtractionConfigurationError(
        "OPENROUTER_API_KEY must be set when using an openrouter extraction profile",
      );
    }

    return new OpenRouterFormExtractionService({
      apiKey: openRouter.apiKey,
      baseUrl: openRouter.baseUrl,
      model: profile.model,
    });
  }
}
