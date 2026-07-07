import { describe, expect, it, vi } from "vitest";

import { DefaultExtractionProfileResolver } from "../../extraction/ExtractionProfileResolver.js";
import { Future } from "../../entities/generic/Future.js";
import { NonRetryableJobError } from "../../jobs/JobErrors.js";
import type { ExtractFormJobInput } from "../../jobs/extract-form/ExtractFormJob.schema.js";
import type { DocumentPreparationService } from "../../services/DocumentPreparationService.js";
import type { FormExtractionServiceFactory } from "../../services/FormExtractionServiceFactory.js";
import type {
  FormExtractionService,
  FormExtractionServiceOutput,
} from "../../services/FormExtractionService.js";
import {
  FormExtractionConfigurationError,
  FormExtractionResponseError,
} from "../../services/FormExtractionErrors.js";
import { createMissingPdfFileReferencesError } from "../../services/DocumentPreparationErrors.js";
import { ExtractFormUseCase } from "../ExtractFormUseCase.js";
import {
  createDocumentPreparationResult,
  createEndOfSeasonExtractedFields,
  createExtractFormResult,
  createExtractFormServiceOutput,
} from "../../../../test/fixtures/ExtractFormFixture.js";
import { endOfSeasonFormDefinition } from "../../forms/end-of-season/EndOfSeasonFormDefinition.js";

const extractFormInput: ExtractFormJobInput = {
  formType: "end-of-season",
  document: {
    bundleId: "bundle-1",
    createdAt: "2026-01-01T12:00:00.000Z",
    kind: "pdf",
    files: [
      {
        bundleId: "bundle-1",
        storageKey: "bundle-1/001.pdf",
        originalFilename: "form.pdf",
        mimetype: "application/pdf",
        size: 1024,
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    ],
  },
};

describe("ExtractFormUseCase", () => {
  it("passes prepared images and the default prompt to the extraction service", async () => {
    const preparedDocument = createDocumentPreparationResult();
    const documentPreparationService = createDocumentPreparationService(preparedDocument);
    const logger = createLoggerStub();
    const extract = vi.fn((input: Parameters<FormExtractionService["extract"]>[0]) => {
      void input;
      return Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
        createExtractFormServiceOutput({ warnings: ["provider warning"] }),
      );
    });
    const extractionService: FormExtractionService = {
      extract,
    };
    const formExtractionServiceFactory = createFormExtractionServiceFactory(extractionService);

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      formExtractionServiceFactory,
      createProfileResolver(),
      logger,
    );

    await expect(useCase.execute(extractFormInput).toPromise()).resolves.toMatchObject(
      createExtractFormResult({
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          profileId: "default:end-of-season",
          warnings: ["provider warning"],
          quality: {
            missingFieldCount: 0,
            invalidFieldCount: 0,
            schemaCoverage: 1,
          },
        },
      }),
    );

    const prepareSpy = documentPreparationService.prepare;
    const extractSpy = extract;

    expect(prepareSpy).toHaveBeenCalledWith(extractFormInput.document);
    expect(formExtractionServiceFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "default:end-of-season",
        formType: "end-of-season",
        provider: "stub",
        model: "stub-model",
      }),
    );

    const extractionCall = extractSpy.mock.calls[0]?.[0];
    expect(extractionCall).toMatchObject({
      formType: endOfSeasonFormDefinition.formType,
      images: preparedDocument.images,
      model: "stub-model",
    });
    expect(extractionCall?.prompt).toMatchObject({
      system:
        "You extract structured data from form images. Return only one valid JSON object and no markdown.",
    });
    expect(extractionCall?.prompt.userText).toContain("Form type: end-of-season");
    expect(extractionCall?.prompt.userText).toContain(
      `Canonical JSON Schema: ${JSON.stringify(endOfSeasonFormDefinition.extractionJsonSchema)}`,
    );
    expect(extractionCall?.prompt.userText).toContain(
      "Extract structured fields from the provided end-of-season form images.",
    );
    expect(logger.debug).toHaveBeenCalledWith(
      {
        formType: "end-of-season",
        bundleId: "bundle-1",
        fileCount: 1,
        model: "stub-model",
        profileId: "default:end-of-season",
        provider: "stub",
      },
      "Extract form started",
    );
    expect(logger.debug).toHaveBeenCalledWith(
      {
        formType: "end-of-season",
        bundleId: "bundle-1",
        imageCount: preparedDocument.images.length,
        warnings: preparedDocument.warnings,
      },
      "Document prepared",
    );
    expect(logger.debug).toHaveBeenCalledWith(
      {
        formType: "end-of-season",
        providerName: "stub",
        model: "stub-model",
        profileId: "default:end-of-season",
        warningCount: 1,
      },
      "Form extraction completed",
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        formType: "end-of-season",
        providerName: "stub",
        model: "stub-model",
        profileId: "default:end-of-season",
      }),
      "Extract form completed",
    );
  });

  it("merges document preparation and provider warnings", async () => {
    const documentPreparationService = createDocumentPreparationService(
      createDocumentPreparationResult({ warnings: ["preparation warning"] }),
    );
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput({ warnings: ["provider warning"] }),
        ),
      ),
    };
    const formExtractionServiceFactory = createFormExtractionServiceFactory(extractionService);

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      formExtractionServiceFactory,
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).resolves.toMatchObject(
      createExtractFormResult({
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          profileId: "default:end-of-season",
          warnings: ["preparation warning", "provider warning"],
          quality: {
            missingFieldCount: 0,
            invalidFieldCount: 0,
            schemaCoverage: 1,
          },
        },
      }),
    );
  });

  it("marks invalid form types as non-retryable", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput(),
        ),
      ),
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(
      useCase
        .execute({ ...extractFormInput, formType: "missing" } as unknown as ExtractFormJobInput)
        .toPromise(),
    ).rejects.toBeInstanceOf(NonRetryableJobError);
  });

  it("marks document preparation failures as non-retryable", async () => {
    const documentPreparationService: DocumentPreparationService = {
      prepare: vi.fn(() =>
        Future.error<Error, ReturnType<typeof createDocumentPreparationResult>>(
          createMissingPdfFileReferencesError(),
        ),
      ),
    };
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput(),
        ),
      ),
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it("fails before document preparation when service factory creation is deterministic", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const prepareSpy = documentPreparationService.prepare;
    const createSpy = vi.fn(() => {
      throw new FormExtractionConfigurationError("Missing OpenRouter API key");
    });
    const formExtractionServiceFactory: FormExtractionServiceFactory = {
      create: createSpy,
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      formExtractionServiceFactory,
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(prepareSpy).not.toHaveBeenCalled();
  });

  it("normalizes missing provider fields through the mapped result", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, FormExtractionServiceOutput>({
          providerName: "stub",
          model: "stub-model",
          extractedFields: createEndOfSeasonExtractedFields(),
          warnings: [],
        }),
      ),
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).resolves.toMatchObject(
      createExtractFormResult({
        result: createEndOfSeasonExtractedFields(),
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          profileId: "default:end-of-season",
          warnings: [],
          quality: {
            missingFieldCount: 0,
            invalidFieldCount: 0,
            schemaCoverage: 1,
          },
        },
      }),
    );
  });

  it("returns schema warnings for missing required provider fields without failing the job", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, FormExtractionServiceOutput>({
          providerName: "stub",
          model: "stub-model",
          extractedFields: createEndOfSeasonExtractedFields({
            end_of_season_report: {
              header_information: {
                country: "Kenya",
                date: "2026-01-01",
              },
            },
          }),
          warnings: [],
        }),
      ),
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).resolves.toMatchObject(
      createExtractFormResult({
        result: createEndOfSeasonExtractedFields({
          end_of_season_report: {
            header_information: {
              country: "Kenya",
              date: "2026-01-01",
            },
          },
        }),
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          profileId: "default:end-of-season",
          warnings: [
            "Missing field: end_of_season_report.header_information.team",
            "Invalid field: end_of_season_report.header_information",
          ],
          quality: {
            missingFieldCount: 1,
            invalidFieldCount: 1,
            schemaCoverage: 4 / 5,
          },
        },
      }),
    );
  });

  it("marks non-object extraction output as non-retryable", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, FormExtractionServiceOutput>({
          providerName: "stub",
          model: "stub-model",
          extractedFields: [],
          warnings: [],
        }),
      ),
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it("marks deterministic extraction provider response failures as non-retryable", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.error<Error, FormExtractionServiceOutput>(
          new FormExtractionResponseError("Provider returned invalid JSON"),
        ),
      ),
    };

    const useCase = new ExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createProfileResolver(),
      createLoggerStub(),
    );

    await expect(useCase.execute(extractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });
});

function createDocumentPreparationService(
  result = createDocumentPreparationResult(),
): DocumentPreparationService & {
  readonly prepare: ReturnType<typeof vi.fn>;
} {
  const prepare = vi.fn((input: ExtractFormJobInput["document"]) => {
    void input;
    return Future.success<Error, ReturnType<typeof createDocumentPreparationResult>>(result);
  });

  return {
    prepare,
  };
}

function createLoggerStub() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
  };
}

function createFormExtractionServiceFactory(
  formExtractionService: FormExtractionService,
): FormExtractionServiceFactory & {
  readonly create: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(() => formExtractionService),
  };
}

function createProfileResolver() {
  return new DefaultExtractionProfileResolver({
    provider: "stub",
    model: "stub-model",
  });
}
