import { describe, expect, it, vi } from "vitest";

import { ExtractionProfileStaticRepository } from "../../../data/repositories/ExtractionProfileStaticRepository.js";
import { DefaultGenericExtractionProfileFactory } from "../../extraction/GenericExtractionProfileFactory.js";
import { Future } from "../../entities/generic/Future.js";
import { NonRetryableJobError } from "../../jobs/JobErrors.js";
import type { GenericExtractFormJobInput } from "../../jobs/generic-extract-form/GenericExtractFormJob.schema.js";
import type { DocumentPreparationService } from "../../services/DocumentPreparationService.js";
import type {
  FormExtractionService,
  FormExtractionServiceOutput,
} from "../../services/FormExtractionService.js";
import type { FormExtractionServiceFactory } from "../../services/FormExtractionServiceFactory.js";
import { GenericExtractFormUseCase } from "../GenericExtractFormUseCase.js";
import { createDocumentPreparationResult } from "../../../../test/fixtures/ExtractFormFixture.js";

const genericExtractFormInput: GenericExtractFormJobInput = {
  form: "caller-label",
  profile: "default",
  prompt: "Extract visible values",
  outputSchema: {
    type: "object",
    required: ["country"],
    properties: {
      country: { type: "string" },
    },
  },
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

describe("GenericExtractFormUseCase", () => {
  it("returns { form, profile, result, diagnostics } for schema-valid output", async () => {
    const extractionService = createExtractionService({
      providerName: "stub",
      model: "stub-model",
      extractedFields: {
        country: "Kenya",
      },
      warnings: ["provider warning"],
    });

    const useCase = new GenericExtractFormUseCase(
      createDocumentPreparationService(),
      createFormExtractionServiceFactory(extractionService),
      createGenericExtractionProfileFactory(),
      createLoggerStub(),
    );

    await expect(useCase.execute(genericExtractFormInput).toPromise()).resolves.toMatchObject({
      form: "caller-label",
      profile: "default",
      result: {
        country: "Kenya",
      },
      diagnostics: {
        providerName: "stub",
        model: "stub-model",
        profile: "default",
        warnings: ["provider warning"],
      },
    });

    const extractionCalls = extractionService.extract.mock.calls as [
      Parameters<FormExtractionService["extract"]>[0],
    ][];
    const extractionCall = extractionCalls[0]?.[0];
    expect(extractionCall?.prompt.system).toBe(
      "You extract structured data from form images. Return only one valid JSON object and no markdown.",
    );
    expect(extractionCall?.prompt.userText).toContain("Form type: caller-label");
    expect(extractionCall?.prompt.userText).toContain(
      'Canonical JSON Schema: {"type":"object","required":["country"],"properties":{"country":{"type":"string"}}}',
    );
    expect(extractionCall?.prompt.userText).toContain(
      "Extraction instructions: Extract visible values",
    );
  });

  it("marks non-object provider output as non-retryable", async () => {
    const useCase = new GenericExtractFormUseCase(
      createDocumentPreparationService(),
      createFormExtractionServiceFactory({
        extract: vi.fn(() =>
          Future.success<Error, FormExtractionServiceOutput>({
            providerName: "stub",
            model: "stub-model",
            extractedFields: [],
            warnings: [],
          }),
        ),
      }),
      createGenericExtractionProfileFactory(),
      createLoggerStub(),
    );

    await expect(useCase.execute(genericExtractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it("marks schema validation failures as non-retryable", async () => {
    const useCase = new GenericExtractFormUseCase(
      createDocumentPreparationService(),
      createFormExtractionServiceFactory({
        extract: vi.fn(() =>
          Future.success<Error, FormExtractionServiceOutput>({
            providerName: "stub",
            model: "stub-model",
            extractedFields: {
              country: 123,
            },
            warnings: [],
          }),
        ),
      }),
      createGenericExtractionProfileFactory(),
      createLoggerStub(),
    );

    await expect(useCase.execute(genericExtractFormInput).toPromise()).rejects.toThrow(
      "Invalid input: expected string, received number",
    );
    await expect(useCase.execute(genericExtractFormInput).toPromise()).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it("returns partial results and quality warnings when required fields are missing", async () => {
    const useCase = new GenericExtractFormUseCase(
      createDocumentPreparationService(),
      createFormExtractionServiceFactory({
        extract: vi.fn(() =>
          Future.success<Error, FormExtractionServiceOutput>({
            providerName: "stub",
            model: "stub-model",
            extractedFields: {},
            warnings: [],
          }),
        ),
      }),
      createGenericExtractionProfileFactory(),
      createLoggerStub(),
    );

    await expect(useCase.execute(genericExtractFormInput).toPromise()).resolves.toMatchObject({
      form: "caller-label",
      profile: "default",
      result: {},
      diagnostics: {
        providerName: "stub",
        model: "stub-model",
        profile: "default",
        warnings: ["Missing field: country"],
        quality: {
          missingFieldCount: 1,
          invalidFieldCount: 0,
          schemaCoverage: 0,
        },
      },
    });
  });

  it("marks unsupported output schemas as non-retryable before preparing documents or calling provider", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService = createExtractionService({
      providerName: "stub",
      model: "stub-model",
      extractedFields: {
        country: "Kenya",
      },
      warnings: [],
    });
    const useCase = new GenericExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createGenericExtractionProfileFactory(),
      createLoggerStub(),
    );

    await expect(
      useCase
        .execute({
          ...genericExtractFormInput,
          outputSchema: {
            type: "unsupported-json-schema-type",
          },
        })
        .toPromise(),
    ).rejects.toBeInstanceOf(NonRetryableJobError);
    expect(documentPreparationService.prepare).not.toHaveBeenCalled();
    expect(extractionService.extract).not.toHaveBeenCalled();
  });

  it("marks non-object output schemas as non-retryable before preparing documents or calling provider", async () => {
    const documentPreparationService = createDocumentPreparationService();
    const extractionService = createExtractionService({
      providerName: "stub",
      model: "stub-model",
      extractedFields: {
        country: "Kenya",
      },
      warnings: [],
    });
    const useCase = new GenericExtractFormUseCase(
      documentPreparationService,
      createFormExtractionServiceFactory(extractionService),
      createGenericExtractionProfileFactory(),
      createLoggerStub(),
    );

    await expect(
      useCase
        .execute({
          ...genericExtractFormInput,
          outputSchema: {
            type: "string",
          },
        })
        .toPromise(),
    ).rejects.toThrow("outputSchema root type must be object");
    expect(documentPreparationService.prepare).not.toHaveBeenCalled();
    expect(extractionService.extract).not.toHaveBeenCalled();
  });
});

function createDocumentPreparationService(
  result = createDocumentPreparationResult(),
): DocumentPreparationService & { readonly prepare: ReturnType<typeof vi.fn> } {
  return {
    prepare: vi.fn(() =>
      Future.success<Error, ReturnType<typeof createDocumentPreparationResult>>(result),
    ),
  };
}

function createFormExtractionServiceFactory(
  formExtractionService: FormExtractionService,
): FormExtractionServiceFactory {
  return {
    create: vi.fn(() => formExtractionService),
  };
}

function createLoggerStub() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
  };
}

function createGenericExtractionProfileFactory() {
  return new DefaultGenericExtractionProfileFactory(
    new ExtractionProfileStaticRepository({
      provider: "stub",
      model: "stub-model",
    }),
  );
}

function createExtractionService(
  output: FormExtractionServiceOutput,
): FormExtractionService & { readonly extract: ReturnType<typeof vi.fn> } {
  return {
    extract: vi.fn(() => Future.success<Error, FormExtractionServiceOutput>(output)),
  };
}
