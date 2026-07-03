import { describe, expect, it, vi } from "vitest";

import { Future } from "../../entities/generic/Future.js";
import { NonRetryableJobError } from "../../jobs/JobErrors.js";
import type { ExtractFormJobInput } from "../../jobs/extract-form/ExtractFormJob.schema.js";
import type { DocumentPreparationService } from "../../services/DocumentPreparationService.js";
import type {
  FormExtractionService,
  FormExtractionServiceOutput,
} from "../../services/FormExtractionService.js";
import { createMissingPdfFileReferencesError } from "../../services/DocumentPreparationErrors.js";
import { ExtractFormUseCase } from "../ExtractFormUseCase.js";
import {
  createDocumentPreparationResult,
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
  it("passes prepared images and schema to the extraction service", async () => {
    const preparedDocument = createDocumentPreparationResult();
    const documentPreparationService = createDocumentPreparationService(preparedDocument);
    const extract = vi.fn((input: Parameters<FormExtractionService["extract"]>[0]) => {
      void input;
      return Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
        createExtractFormServiceOutput({ warnings: ["provider warning"] }),
      );
    });
    const extractionService: FormExtractionService = {
      extract,
    };

    const useCase = new ExtractFormUseCase(documentPreparationService, extractionService, {
      model: "stub-model",
    });

    await expect(useCase.execute(extractFormInput).toPromise()).resolves.toMatchObject(
      createExtractFormResult({
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          warnings: ["provider warning"],
        },
      }),
    );

    const prepareSpy = documentPreparationService.prepare;
    const extractSpy = extract;

    expect(prepareSpy).toHaveBeenCalledWith(extractFormInput.document);

    const extractionCall = extractSpy.mock.calls[0]?.[0];
    expect(extractionCall).toMatchObject({
      formType: endOfSeasonFormDefinition.formType,
      jsonSchema: endOfSeasonFormDefinition.jsonSchema,
      images: preparedDocument.images,
      model: "stub-model",
    });
    expect(extractionCall?.instructions).toContain("end-of-season");
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

    const useCase = new ExtractFormUseCase(documentPreparationService, extractionService, {
      model: "stub-model",
    });

    await expect(useCase.execute(extractFormInput).toPromise()).resolves.toMatchObject(
      createExtractFormResult({
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          warnings: ["preparation warning", "provider warning"],
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

    const useCase = new ExtractFormUseCase(documentPreparationService, extractionService, {
      model: "stub-model",
    });

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

    const useCase = new ExtractFormUseCase(documentPreparationService, extractionService, {
      model: "stub-model",
    });

    await expect(useCase.execute(extractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it("marks invalid extraction output as non-retryable", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, FormExtractionServiceOutput>({
          providerName: "stub",
          model: "stub-model",
          extractedFields: { country: "Kenya" },
          warnings: [],
        }),
      ),
    };

    const useCase = new ExtractFormUseCase(documentPreparationService, extractionService, {
      model: "stub-model",
    });

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
