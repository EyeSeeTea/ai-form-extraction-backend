import type {
  FormExtractionService,
  FormExtractionServiceInput,
} from "../../domain/services/FormExtractionService.js";
import { OpenAiCompatibleFormExtractionService } from "./OpenAiCompatibleFormExtractionService.js";
export type { OpenAiCompatibleChatCompletionRequest as OllamaChatCompletionRequest } from "./OpenAiCompatibleFormExtractionService.js";

export type OllamaFormExtractionServiceConfig = Readonly<{
  apiKey: string;
  baseUrl: string;
  model: string;
}>;

export class OllamaFormExtractionService implements FormExtractionService {
  private readonly service: OpenAiCompatibleFormExtractionService;

  constructor(config: OllamaFormExtractionServiceConfig) {
    this.service = new OpenAiCompatibleFormExtractionService({
      ...config,
      providerName: "ollama",
      providerDisplayName: "Ollama",
      includeCost: false,
    });
  }

  extract(input: FormExtractionServiceInput): ReturnType<FormExtractionService["extract"]> {
    return this.service.extract(input);
  }
}
