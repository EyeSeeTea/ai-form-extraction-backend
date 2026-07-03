import { Future } from "../../domain/entities/generic/Future.js";
import type {
  FormExtractionService,
  FormExtractionServiceInput,
  FormExtractionServiceOutput,
} from "../../domain/services/FormExtractionService.js";

export class StubFormExtractionService implements FormExtractionService {
  constructor(private readonly providerName = "stub") {}

  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput> {
    return Future.success({
      providerName: this.providerName,
      model: "stub-model",
      extractedFields: {
        formType: input.formType,
        country: "Kenya",
        team: "Nairobi East",
        date: "2026-01-01",
      },
      warnings: [`Processed ${String(input.images.length)} prepared image(s)`],
    });
  }
}
