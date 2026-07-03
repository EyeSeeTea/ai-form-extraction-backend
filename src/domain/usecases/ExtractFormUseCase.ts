import { Future } from "../entities/generic/Future.js";
import type { JsonObject } from "../entities/Job.js";
import { NonRetryableJobError } from "../jobs/JobErrors.js";
import type { DocumentPreparationService } from "../services/DocumentPreparationService.js";
import type { FormExtractionService } from "../services/FormExtractionService.js";
import { isDocumentPreparationError } from "../services/DocumentPreparationErrors.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractFormJobInput } from "../jobs/extract-form/ExtractFormJob.schema.js";
import { ValidationError } from "../../shared/ValidationError.js";
import { ZodError } from "zod";

export type ExtractFormResult = JsonObject & {
  readonly formType: string;
  readonly extractedFields: JsonObject;
  readonly result: JsonObject;
  readonly diagnostics: {
    readonly providerName: string;
    readonly model: string;
    readonly warnings: string[];
    readonly usage?: {
      readonly inputTokens?: number;
      readonly outputTokens?: number;
      readonly totalTokens?: number;
      readonly costUsd?: number;
    };
    readonly rawResponseId?: string;
  };
};

export type ExtractFormUseCaseConfig = {
  readonly model: string;
};

export class ExtractFormUseCase {
  constructor(
    private readonly documentPreparationService: DocumentPreparationService,
    private readonly formExtractionService: FormExtractionService,
    private readonly config: ExtractFormUseCaseConfig,
  ) {}

  execute(input: ExtractFormJobInput): Future<Error, ExtractFormResult> {
    return Future.block<Error, ExtractFormResult>(async ($) => {
      try {
        const formDefinition = getFormDefinition(input.formType);
        if (!formDefinition) {
          throw new ValidationError(`Unknown form type: ${input.formType}`);
        }

        const preparedDocument = await $(this.documentPreparationService.prepare(input.document));
        const extraction = await $(
          this.formExtractionService.extract({
            formType: formDefinition.formType,
            jsonSchema: formDefinition.jsonSchema,
            images: preparedDocument.images,
            instructions: buildFormExtractionInstructions(formDefinition.formType),
            model: this.config.model,
          }),
        );

        const extractedFields = formDefinition.extractionSchema.parse(extraction.extractedFields);
        const result = formDefinition.mapResult(extractedFields);

        const diagnostics = {
          providerName: extraction.providerName,
          model: extraction.model,
          warnings: [...preparedDocument.warnings, ...extraction.warnings],
          ...(extraction.usage ? { usage: extraction.usage } : {}),
          ...(extraction.rawResponseId ? { rawResponseId: extraction.rawResponseId } : {}),
        } satisfies ExtractFormResult["diagnostics"];

        return {
          formType: formDefinition.formType,
          extractedFields,
          result,
          diagnostics,
        };
      } catch (error) {
        throw toNonRetryableExtractFormError(error);
      }
    });
  }
}

function toNonRetryableExtractFormError(error: unknown): Error {
  if (error instanceof NonRetryableJobError) {
    return error;
  }

  if (
    error instanceof ValidationError ||
    isDocumentPreparationError(error) ||
    error instanceof ZodError
  ) {
    return new NonRetryableJobError(error.message, error);
  }

  return error instanceof Error ? error : new Error(String(error));
}

function buildFormExtractionInstructions(formType: string): string {
  return [
    `Extract structured fields from the provided ${formType} form images.`,
    "Return a single JSON object that matches the provided JSON Schema.",
    "Do not include markdown, commentary, or additional wrapper keys.",
  ].join(" ");
}
