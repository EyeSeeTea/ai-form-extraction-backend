import type { Logger } from "pino";
import { Future } from "../entities/generic/Future.js";
import type { JsonObject, JsonValue } from "../entities/Job.js";
import { composePrompt } from "../extraction/PromptComposer.js";
import type { ExtractionProfileResolver } from "../extraction/ExtractionProfileResolver.js";
import {
  validateExtractionResult,
  type ExtractionResultQuality,
} from "../forms/ExtractionResultValidator.js";
import { NonRetryableJobError } from "../jobs/JobErrors.js";
import type { DocumentPreparationService } from "../services/DocumentPreparationService.js";
import type { FormExtractionService } from "../services/FormExtractionService.js";
import { isDocumentPreparationError } from "../services/DocumentPreparationErrors.js";
import { isDeterministicFormExtractionError } from "../services/FormExtractionErrors.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractFormJobInput } from "../jobs/extract-form/ExtractFormJob.schema.js";
import { ValidationError } from "../../shared/ValidationError.js";

export type ExtractFormResult = JsonObject & {
  readonly formType: string;
  readonly extractedFields: JsonObject;
  readonly result: JsonObject;
  readonly diagnostics: {
    readonly providerName: string;
    readonly model: string;
    readonly profileId: string;
    readonly warnings: string[];
    readonly usage?: {
      readonly inputTokens?: number;
      readonly outputTokens?: number;
      readonly totalTokens?: number;
      readonly costUsd?: number;
    };
    readonly rawResponseId?: string;
    readonly quality: ExtractionResultQuality;
  };
};

export class ExtractFormUseCase {
  constructor(
    private readonly documentPreparationService: DocumentPreparationService,
    private readonly formExtractionService: FormExtractionService,
    private readonly extractionProfileResolver: ExtractionProfileResolver,
    private readonly logger: Pick<Logger, "debug" | "error">,
  ) {}

  execute(input: ExtractFormJobInput): Future<Error, ExtractFormResult> {
    return Future.block<Error, ExtractFormResult>(async ($) => {
      try {
        const profile = this.extractionProfileResolver.resolve(input.formType);
        this.logger.debug(
          {
            formType: profile.formType,
            bundleId: input.document.bundleId,
            fileCount: input.document.files.length,
            model: profile.model,
            profileId: profile.id,
            provider: profile.provider,
          },
          "Extract form started",
        );

        const formDefinition = getFormDefinition(profile.formType);
        if (!formDefinition) {
          throw new ValidationError(`Unknown form type: ${profile.formType}`);
        }

        const preparedDocument = await $(this.documentPreparationService.prepare(input.document));
        this.logger.debug(
          {
            formType: input.formType,
            bundleId: input.document.bundleId,
            imageCount: preparedDocument.images.length,
            warnings: preparedDocument.warnings,
          },
          "Document prepared",
        );

        const extraction = await $(
          this.formExtractionService.extract({
            formType: profile.formType,
            prompt: composePrompt(profile),
            images: preparedDocument.images,
            model: profile.model,
          }),
        );
        this.logger.debug(
          {
            formType: formDefinition.formType,
            providerName: extraction.providerName,
            model: extraction.model,
            profileId: profile.id,
            warningCount: extraction.warnings.length,
          },
          "Form extraction completed",
        );

        const extractedFields = parseExtractedFields(extraction.extractedFields);
        const parsedFields = formDefinition.extractionSchema.safeParse(extractedFields);
        if (!parsedFields.success) {
          throw new ValidationError(parsedFields.error.message);
        }

        const result = formDefinition.mapResult(parsedFields.data);
        const validation = validateExtractionResult({
          jsonSchema: formDefinition.resultJsonSchema,
          resultSchema: formDefinition.resultSchema,
          result,
        });

        const diagnostics = {
          providerName: extraction.providerName,
          model: extraction.model,
          profileId: profile.id,
          warnings: [...preparedDocument.warnings, ...extraction.warnings, ...validation.warnings],
          ...(extraction.usage ? { usage: extraction.usage } : {}),
          ...(extraction.rawResponseId ? { rawResponseId: extraction.rawResponseId } : {}),
          quality: validation.quality,
        } satisfies ExtractFormResult["diagnostics"];
        this.logger.debug(
          {
            formType: formDefinition.formType,
            providerName: extraction.providerName,
            model: extraction.model,
            profileId: profile.id,
            warnings: diagnostics.warnings,
            quality: diagnostics.quality,
          },
          "Extract form completed",
        );

        return {
          formType: formDefinition.formType,
          extractedFields,
          result,
          diagnostics,
        };
      } catch (error) {
        this.logger.error(
          {
            formType: input.formType,
            bundleId: input.document.bundleId,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          "Extract form failed",
        );
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
    isDeterministicFormExtractionError(error)
  ) {
    return new NonRetryableJobError(error.message, error);
  }

  return error instanceof Error ? error : new Error(String(error));
}

function parseExtractedFields(extractedFields: JsonValue): JsonObject {
  if (isJsonObject(extractedFields)) {
    return extractedFields;
  }

  throw new ValidationError("Extraction result must be a JSON object");
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
