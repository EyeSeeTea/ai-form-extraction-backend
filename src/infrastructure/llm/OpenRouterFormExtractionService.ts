import type {
  FormExtractionService,
  FormExtractionServiceInput,
} from "../../domain/services/FormExtractionService.js";
import { OpenAiCompatibleFormExtractionService } from "./OpenAiCompatibleFormExtractionService.js";
export type { OpenAiCompatibleChatCompletionRequest as OpenRouterChatCompletionRequest } from "./OpenAiCompatibleFormExtractionService.js";

export type OpenRouterFormExtractionServiceConfig = Readonly<{
  apiKey: string;
  baseUrl: string;
  model: string;
}>;

export class OpenRouterFormExtractionService implements FormExtractionService {
  private readonly service: OpenAiCompatibleFormExtractionService;

  constructor(config: OpenRouterFormExtractionServiceConfig) {
    this.service = new OpenAiCompatibleFormExtractionService({
      ...config,
      providerName: "openrouter",
      providerDisplayName: "OpenRouter",
      includeCost: true,
    });
  }

  extract(input: FormExtractionServiceInput): ReturnType<FormExtractionService["extract"]> {
    return this.service.extract(input);
  }
}
