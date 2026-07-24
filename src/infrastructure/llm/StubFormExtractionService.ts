import { Future } from "../../domain/entities/generic/Future.js";
import type {
  FormExtractionService,
  FormExtractionServiceInput,
  FormExtractionServiceOutput,
} from "../../domain/services/FormExtractionService.js";

export class StubFormExtractionService implements FormExtractionService {
  constructor(
    private readonly providerName = "stub",
    private readonly model = "stub-model",
  ) {}

  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput> {
    return Future.success({
      providerName: this.providerName,
      model: this.model,
      extractedFields: {
        end_of_season_report: {
          header_information: {
            country: "Kenya",
            team: "Nairobi East",
            date: "2026-01-01",
          },
        },
      },
      fieldConfidence: {
        "/end_of_season_report/header_information/country": 0.95,
        "/end_of_season_report/header_information/team": 0.9,
        "/end_of_season_report/header_information/date": 0.85,
      },
      warnings: [`Processed ${String(input.images.length)} prepared image(s)`],
    });
  }
}
