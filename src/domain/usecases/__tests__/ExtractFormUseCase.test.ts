import { describe, expect, it, vi } from "vitest";

import { Future } from "../../entities/generic/Future.js";
import { NonRetryableJobError } from "../../jobs/JobErrors.js";
import type { ExtractFormJobInput } from "../../jobs/extract-form/ExtractFormJob.schema.js";
import type { FormExtractionService } from "../../services/FormExtractionService.js";
import { createMissingPdfFileReferencesError } from "../../services/DocumentPreparationErrors.js";
import type { FormExtractionServiceOutput } from "../../services/FormExtractionService.js";
import { ExtractFormUseCase } from "../ExtractFormUseCase.js";
import {
  createExtractFormResult,
  createExtractFormServiceOutput,
} from "../../../../test/fixtures/ExtractFormFixture.js";

describe("ExtractFormUseCase", () => {
  it("returns extracted fields and mapped result", async () => {
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput({ warnings: ["ok"] }),
        ),
      ),
    };

    const useCase = new ExtractFormUseCase(extractionService);

    await expect(
      useCase
        .execute({
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
        })
        .toPromise(),
    ).resolves.toMatchObject(
      createExtractFormResult({ diagnostics: { providerName: "stub", warnings: ["ok"] } }),
    );
  });

  it("marks invalid form types as non-retryable", async () => {
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput(),
        ),
      ),
    };

    const useCase = new ExtractFormUseCase(extractionService);

    await expect(
      useCase
        .execute({
          formType: "missing",
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
        } as unknown as ExtractFormJobInput)
        .toPromise(),
    ).rejects.toBeInstanceOf(NonRetryableJobError);
  });

  it("marks document preparation failures as non-retryable", async () => {
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.error<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createMissingPdfFileReferencesError(),
        ),
      ),
    };

    const useCase = new ExtractFormUseCase(extractionService);

    await expect(
      useCase
        .execute({
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
        })
        .toPromise(),
    ).rejects.toBeInstanceOf(NonRetryableJobError);
  });

  it("marks invalid extraction output as non-retryable", async () => {
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, FormExtractionServiceOutput>({
          providerName: "stub",
          extractedFields: { country: "Kenya" },
          warnings: [],
        }),
      ),
    };

    const useCase = new ExtractFormUseCase(extractionService);

    await expect(
      useCase
        .execute({
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
        })
        .toPromise(),
    ).rejects.toBeInstanceOf(NonRetryableJobError);
  });
});
