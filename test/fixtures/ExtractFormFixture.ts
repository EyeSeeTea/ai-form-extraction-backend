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
    extractedFields: createEndOfSeasonExtractedFields(),
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
      warnings: [],
    };
  }

  return {
    providerName: diagnostics.providerName,
    warnings: diagnostics.warnings,
  };
}

function isJsonObject(value: unknown): value is Partial<EndOfSeasonExtractedFields> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
