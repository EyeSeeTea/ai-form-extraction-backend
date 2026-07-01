import { Future } from "../../domain/entities/generic/Future.js";
import type {
  FormExtractionService,
  FormExtractionServiceInput,
  FormExtractionServiceOutput,
} from "../../domain/services/FormExtractionService.js";

export class StubFormExtractionService implements FormExtractionService {
  constructor(private readonly providerName = "stub-form-extraction") {}

  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput> {
    return Future.success({
      providerName: this.providerName,
      extractedFields: {
        formType: input.formDefinition.formType,
        country: "Kenya",
        team: "Nairobi East",
        date: "2026-01-01",
      },
      warnings: [
        `Processed bundle ${input.source.bundleId} with ${String(input.source.files.length)} file(s)`,
      ],
    });
  }
}
