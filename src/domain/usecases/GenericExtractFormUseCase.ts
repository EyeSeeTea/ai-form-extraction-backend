import type { Logger } from "pino";

import type { JsonObject } from "../entities/generic/Json.js";
import { Future } from "../entities/generic/Future.js";
import type { GenericExtractionProfileFactory } from "../extraction/GenericExtractionProfileFactory.js";
import { composePrompt } from "../extraction/PromptComposer.js";
import {
  validateExtractionResult,
  type ExtractionResultIssue,
  type ExtractionResultQuality,
} from "../forms/ExtractionResultValidator.js";
import { buildGenericExtractFormResultSchema } from "../jobs/generic-extract-form/GenericExtractFormContract.js";
import type { GenericExtractFormJobInput } from "../jobs/generic-extract-form/GenericExtractFormJob.schema.js";
import type { DocumentPreparationService } from "../services/DocumentPreparationService.js";
import type { FormExtractionServiceFactory } from "../services/FormExtractionServiceFactory.js";
import {
  parseExtractedFields,
  toNonRetryableExtractFormError,
} from "./support/ExtractionUseCaseSupport.js";

export type GenericExtractFormResult = JsonObject &
  Readonly<{
    form: string;
    profile: string;
    result: JsonObject;
    diagnostics: Readonly<{
      providerName: string;
      model: string;
      profile: string;
      warnings: string[];
      issues: ExtractionResultIssue[];
      usage?: Readonly<{
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        costUsd?: number;
      }>;
      rawResponseId?: string;
      quality: ExtractionResultQuality;
    }>;
  }>;

export class GenericExtractFormUseCase {
  constructor(
    private readonly documentPreparationService: DocumentPreparationService,
    private readonly formExtractionServiceFactory: FormExtractionServiceFactory,
    private readonly genericExtractionProfileFactory: GenericExtractionProfileFactory,
    private readonly logger: Pick<Logger, "debug" | "error">,
  ) {}

  execute(input: GenericExtractFormJobInput): Future<Error, GenericExtractFormResult> {
    return Future.block(async ($) => {
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
      const resultSchema = buildGenericExtractFormResultSchema(input.outputSchema);

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

      const validation = validateExtractionResult({
        jsonSchema: input.outputSchema,
        resultSchema,
        result: extractedFields,
      });
      const diagnostics = {
        providerName: extraction.providerName,
        model: extraction.model,
        profile: input.profile,
        warnings: [...preparedDocument.warnings, ...extraction.warnings, ...validation.warnings],
        ...(extraction.usage ? { usage: extraction.usage } : {}),
        ...(extraction.rawResponseId ? { rawResponseId: extraction.rawResponseId } : {}),
        quality: validation.quality,
        issues: validation.issues,
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
        result: extractedFields,
        diagnostics,
      };
    }).mapError((error) => {
      this.logger.error(
        {
          form: input.form,
          profile: input.profile,
          bundleId: input.document.bundleId,
          err: error instanceof Error ? error : new Error(String(error)),
        },
        "Generic extract form failed",
      );
      return toNonRetryableExtractFormError(error);
    });
  }
}
