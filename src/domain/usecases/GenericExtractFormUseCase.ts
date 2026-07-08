import type { Logger } from "pino";

import { ValidationError } from "../../shared/ValidationError.js";
import type { JsonObject } from "../entities/generic/Json.js";
import { Future } from "../entities/generic/Future.js";
import type { GenericExtractionProfileFactory } from "../extraction/GenericExtractionProfileFactory.js";
import { composePrompt } from "../extraction/PromptComposer.js";
import {
  validateExtractionResult,
  type ExtractionResultQuality,
} from "../forms/ExtractionResultValidator.js";
import { buildGenericExtractFormResultSchemas } from "../jobs/generic-extract-form/GenericExtractFormContract.js";
import type { GenericExtractFormJobInput } from "../jobs/generic-extract-form/GenericExtractFormJob.schema.js";
import type { DocumentPreparationService } from "../services/DocumentPreparationService.js";
import type { FormExtractionServiceFactory } from "../services/FormExtractionServiceFactory.js";
import {
  parseExtractedFields,
  toNonRetryableExtractFormError,
} from "./support/ExtractionUseCaseSupport.js";

export type GenericExtractFormResult = JsonObject & {
  readonly form: string;
  readonly profile: string;
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

export class GenericExtractFormUseCase {
  constructor(
    private readonly documentPreparationService: DocumentPreparationService,
    private readonly formExtractionServiceFactory: FormExtractionServiceFactory,
    private readonly genericExtractionProfileFactory: GenericExtractionProfileFactory,
    private readonly logger: Pick<Logger, "debug" | "error">,
  ) {}

  execute(input: GenericExtractFormJobInput): Future<Error, GenericExtractFormResult> {
    return Future.block(async ($) => {
      try {
        const profile = this.genericExtractionProfileFactory.create({
          profile: input.profile,
          form: input.form,
          extractionJsonSchema: input.outputSchema,
          instructions: input.prompt,
        });

        this.logger.debug(
          {
            form: input.form,
            profile: input.profile,
            bundleId: input.document.bundleId,
            fileCount: input.document.files.length,
            model: profile.model,
            provider: profile.provider,
          },
          "Generic extract form started",
        );

        const formExtractionService = this.formExtractionServiceFactory.create(profile);
        const { extractionSchema, resultSchema } = buildGenericExtractFormResultSchemas(
          input.outputSchema,
        );

        const preparedDocument = await $(this.documentPreparationService.prepare(input.document));
        this.logger.debug(
          {
            form: input.form,
            profile: input.profile,
            bundleId: input.document.bundleId,
            imageCount: preparedDocument.images.length,
            warnings: preparedDocument.warnings,
          },
          "Generic document prepared",
        );

        const extraction = await $(
          formExtractionService.extract({
            formType: input.form,
            prompt: composePrompt(profile),
            images: preparedDocument.images,
            model: profile.model,
          }),
        );
        this.logger.debug(
          {
            form: input.form,
            profile: input.profile,
            providerName: extraction.providerName,
            model: extraction.model,
            warningCount: extraction.warnings.length,
          },
          "Generic form extraction completed",
        );

        const extractedFields = parseExtractedFields(extraction.extractedFields);
        const parsedFields = extractionSchema.safeParse(extractedFields);
        if (!parsedFields.success) {
          throw new ValidationError(parsedFields.error.message);
        }

        const validation = validateExtractionResult({
          jsonSchema: input.outputSchema,
          resultSchema,
          result: parsedFields.data,
        });
        const diagnostics = {
          providerName: extraction.providerName,
          model: extraction.model,
          profile: input.profile,
          warnings: [...preparedDocument.warnings, ...extraction.warnings, ...validation.warnings],
          ...(extraction.usage ? { usage: extraction.usage } : {}),
          ...(extraction.rawResponseId ? { rawResponseId: extraction.rawResponseId } : {}),
          quality: validation.quality,
        } satisfies GenericExtractFormResult["diagnostics"];

        this.logger.debug(
          {
            form: input.form,
            profile: input.profile,
            providerName: extraction.providerName,
            model: extraction.model,
            warnings: diagnostics.warnings,
            quality: diagnostics.quality,
          },
          "Generic extract form completed",
        );

        return {
          form: input.form,
          profile: input.profile,
          result: parsedFields.data,
          diagnostics,
        };
      } catch (error) {
        this.logger.error(
          {
            form: input.form,
            profile: input.profile,
            bundleId: input.document.bundleId,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          "Generic extract form failed",
        );
        throw toNonRetryableExtractFormError(error);
      }
    });
  }
}
