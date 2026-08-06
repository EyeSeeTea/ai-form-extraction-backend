import { FormExtractionConfigurationError } from "../../domain/services/FormExtractionErrors.js";
import type { FormExtractionServiceFactory } from "../../domain/services/FormExtractionServiceFactory.js";
import type { ExtractionProfile } from "../../domain/extraction/ExtractionProfile.js";
import type { FormExtractionService } from "../../domain/services/FormExtractionService.js";
import { OllamaFormExtractionService } from "./OllamaFormExtractionService.js";
import { OpenRouterFormExtractionService } from "./OpenRouterFormExtractionService.js";
import { StubFormExtractionService } from "./StubFormExtractionService.js";

export type DefaultFormExtractionServiceFactoryConfig = Readonly<{
  openRouter?: Readonly<{
    apiKey?: string;
    baseUrl: string;
  }>;
  ollama?: Readonly<{
    apiKey: string;
    baseUrl: string;
  }>;
  stub?: Readonly<{
    resultsDirectory?: string;
  }>;
}>;

export class DefaultFormExtractionServiceFactory implements FormExtractionServiceFactory {
  constructor(private readonly config: DefaultFormExtractionServiceFactoryConfig) {}

  create(profile: ExtractionProfile): FormExtractionService {
    if (profile.provider === "stub") {
      return new StubFormExtractionService({
        providerName: "stub",
        model: profile.model,
        extractionJsonSchema: profile.extractionJsonSchema,
        ...(this.config.stub?.resultsDirectory
          ? { resultsDirectory: this.config.stub.resultsDirectory }
          : {}),
      });
    }

    if (profile.provider === "ollama") {
      const ollama = this.config.ollama;
      if (!ollama) {
        throw new FormExtractionConfigurationError(
          "OLLAMA_BASE_URL must be set when using an ollama extraction profile",
        );
      }

      return new OllamaFormExtractionService({
        apiKey: ollama.apiKey,
        baseUrl: ollama.baseUrl,
        model: profile.model,
      });
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
