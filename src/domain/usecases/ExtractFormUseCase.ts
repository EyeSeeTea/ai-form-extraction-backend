import { Future } from "../entities/generic/Future.js";
import type { JsonObject } from "../entities/Job.js";
import type { FormExtractionService } from "../services/FormExtractionService.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractFormJobInput } from "../jobs/extract-form/ExtractFormJob.schema.js";
import { ValidationError } from "../../shared/ValidationError.js";

export type ExtractFormResult = JsonObject & {
  readonly formType: string;
  readonly extractedFields: JsonObject;
  readonly result: JsonObject;
  readonly diagnostics: {
    readonly providerName: string;
    readonly warnings: string[];
  };
};

export class ExtractFormUseCase {
  constructor(private readonly formExtractionService: FormExtractionService) {}

  execute(input: ExtractFormJobInput): Future<Error, ExtractFormResult> {
    return Future.block<Error, ExtractFormResult>(async ($) => {
      const formDefinition = getFormDefinition(input.formType);
      if (!formDefinition) {
        throw new ValidationError(`Unknown form type: ${input.formType}`);
      }

      const extraction = await $(
        this.formExtractionService.extract({
          formDefinition,
          document: input.document,
          source: {
            bundleId: input.document.bundleId,
            createdAt: input.document.createdAt,
            kind: input.document.kind,
            files: input.document.files.map((file) => ({
              storageKey: file.storageKey,
              mimetype: file.mimetype,
              size: file.size,
              sha256: file.sha256,
            })),
          },
        }),
      );

      const extractedFields = formDefinition.extractionSchema.parse(extraction.extractedFields);
      const result = formDefinition.mapResult(extractedFields);

      return {
        formType: formDefinition.formType,
        extractedFields,
        result,
        diagnostics: {
          providerName: extraction.providerName,
          warnings: extraction.warnings,
        },
      };
    });
  }
}
