import { describe, expect, it, vi } from "vitest";

import { Future } from "../../entities/generic/Future.js";
import type { FormExtractionService } from "../../services/FormExtractionService.js";
import { ExtractFormUseCase } from "../ExtractFormUseCase.js";
import {
  createExtractFormResult,
  createExtractFormServiceOutput,
} from "../../../../test/fixtures/ExtractFormFixture.js";

describe("ExtractFormUseCase", () => {
  it("returns extracted fields and tracker payload", async () => {
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
});
