import type { Logger } from "pino";
import { Future } from "../entities/generic/Future.js";
import { composePrompt } from "../extraction/PromptComposer.js";
import type { ManagedExtractionProfileResolver } from "../extraction/ManagedExtractionProfileResolver.js";
import {
  validateExtractionResult,
  type ExtractionResultQuality,
} from "../forms/ExtractionResultValidator.js";
import type { DocumentPreparationService } from "../services/DocumentPreparationService.js";
import type { FormExtractionServiceFactory } from "../services/FormExtractionServiceFactory.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractFormJobInput } from "../jobs/extract-form/ExtractFormJob.schema.js";
import { ValidationError } from "../../shared/ValidationError.js";
import type { JsonObject } from "../entities/generic/Json.js";
import {
  parseExtractedFields,
  toNonRetryableExtractFormError,
} from "./support/ExtractionUseCaseSupport.js";

export type ExtractFormResult = JsonObject & {
  readonly formType: string;
  readonly result: JsonObject;
  readonly diagnostics: {
    readonly providerName: string;
    readonly model: string;
    readonly profile: string;
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
    private readonly formExtractionServiceFactory: FormExtractionServiceFactory,
    private readonly managedExtractionProfileResolver: ManagedExtractionProfileResolver,
    private readonly logger: Pick<Logger, "debug" | "error">,
  ) {}

  execute(input: ExtractFormJobInput): Future<Error, ExtractFormResult> {
    return Future.block<Error, ExtractFormResult>(async ($) => {
      try {
        const profile = this.managedExtractionProfileResolver.resolve("default", input.formType);
        this.logger.debug(
          {
            formType: profile.formType,
            bundleId: input.document.bundleId,
            fileCount: input.document.files.length,
            model: profile.model,
            profile: profile.id,
            provider: profile.provider,
          },
          "Extract form started",
        );

        const formDefinition = getFormDefinition(profile.formType);
        if (!formDefinition) {
          throw new ValidationError(`Unknown form type: ${profile.formType}`);
        }

        const formExtractionService = this.formExtractionServiceFactory.create(profile);
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
          formExtractionService.extract({
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
            profile: profile.id,
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
          profile: profile.id,
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
            profile: profile.id,
            warnings: diagnostics.warnings,
            quality: diagnostics.quality,
          },
          "Extract form completed",
        );

        return {
          formType: formDefinition.formType,
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
