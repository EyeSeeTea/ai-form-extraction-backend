import type { DocumentPreparationResult } from "../../src/domain/services/DocumentPreparationService.js";
import type { ExtractFormResult } from "../../src/domain/usecases/ExtractFormUseCase.js";
import type { FormExtractionServiceOutput } from "../../src/domain/services/FormExtractionService.js";
import {
  endOfSeasonFormDefinition,
  type EndOfSeasonExtractedFields,
} from "../../src/domain/forms/end-of-season/EndOfSeasonFormDefinition.js";

export const endOfSeasonExtractedFieldsFixture: EndOfSeasonExtractedFields = {
  formType: "end-of-season",
  country: "Kenya",
  team: "Nairobi East",
  date: "2026-01-01",
};

export function createEndOfSeasonExtractedFields(
  overrides: Partial<EndOfSeasonExtractedFields> = {},
): EndOfSeasonExtractedFields {
  return {
    ...endOfSeasonExtractedFieldsFixture,
    ...overrides,
  };
}

export function createExtractFormServiceOutput(
  overrides: Partial<FormExtractionServiceOutput<EndOfSeasonExtractedFields>> = {},
): FormExtractionServiceOutput<EndOfSeasonExtractedFields> {
  return {
    providerName: "stub",
    model: "stub-model",
    extractedFields: createEndOfSeasonExtractedFields(),
    warnings: [],
    ...overrides,
  };
}

export function createDocumentPreparationResult(
  overrides: Partial<DocumentPreparationResult> = {},
): DocumentPreparationResult {
  return {
    images: [
      {
        pageNumber: 1,
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
        source: {
          storageKey: "bundle-1/001.png",
          sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
      },
    ],
    warnings: [],
    ...overrides,
  };
}

export function createExtractFormResult(
  overrides: Partial<ExtractFormResult> = {},
): ExtractFormResult {
  const extractedFields = createEndOfSeasonExtractedFields(
    extractExtractedFieldOverrides(overrides),
  );
  const diagnostics = createDiagnostics(overrides.diagnostics);
  const result = isJsonObject(overrides.result)
    ? overrides.result
    : endOfSeasonFormDefinition.mapResult(extractedFields);

  return {
    formType: endOfSeasonFormDefinition.formType,
    ...overrides,
    extractedFields,
    result,
    diagnostics,
  };
}

function extractExtractedFieldOverrides(
  overrides: Partial<ExtractFormResult>,
): Partial<EndOfSeasonExtractedFields> {
  if (!isJsonObject(overrides.extractedFields)) {
    return {};
  }

  return overrides.extractedFields;
}

function isDiagnosticsObject(value: unknown): value is ExtractFormResult["diagnostics"] {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createDiagnostics(diagnostics: unknown): ExtractFormResult["diagnostics"] {
  if (!isDiagnosticsObject(diagnostics)) {
    return {
      providerName: "stub",
      model: "stub-model",
      warnings: [],
    };
  }

  return {
    providerName: typeof diagnostics.providerName === "string" ? diagnostics.providerName : "stub",
    model: typeof diagnostics.model === "string" ? diagnostics.model : "stub-model",
    warnings: Array.isArray(diagnostics.warnings) ? diagnostics.warnings : [],
    ...(isJsonObject(diagnostics.usage) ? { usage: diagnostics.usage } : {}),
    ...(typeof diagnostics.rawResponseId === "string"
      ? { rawResponseId: diagnostics.rawResponseId }
      : {}),
  } satisfies ExtractFormResult["diagnostics"];
}

function isJsonObject(value: unknown): value is Partial<EndOfSeasonExtractedFields> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
