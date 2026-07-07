import type { DocumentPreparationResult } from "../../src/domain/services/DocumentPreparationService.js";
import type { ExtractFormResult } from "../../src/domain/usecases/ExtractFormUseCase.js";
import type { FormExtractionServiceOutput } from "../../src/domain/services/FormExtractionService.js";
import {
  endOfSeasonFormDefinition,
  type EndOfSeasonExtractedFields,
} from "../../src/domain/forms/end-of-season/EndOfSeasonFormDefinition.js";
import type { JsonObject } from "../../src/domain/entities/generic/Json.js";

export const endOfSeasonExtractedFieldsFixture: EndOfSeasonExtractedFields = {
  end_of_season_report: {
    header_information: {
      country: "Kenya",
      team: "Nairobi East",
      date: "2026-01-01",
    },
  },
};

export function createEndOfSeasonExtractedFields(
  overrides: Partial<EndOfSeasonExtractedFields> = {},
): EndOfSeasonExtractedFields {
  return mergeJsonObjects(endOfSeasonExtractedFieldsFixture, overrides);
}

export function createExtractFormServiceOutput(
  overrides: Partial<FormExtractionServiceOutput<JsonObject>> = {},
): FormExtractionServiceOutput<JsonObject> {
  return {
    providerName: "stub",
    model: "stub-model",
    extractedFields: endOfSeasonExtractedFieldsFixture,
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
  const extractedFields = extractExtractedFieldOverrides(overrides.result);
  const diagnostics = createDiagnostics(overrides.diagnostics);
  const mappedFields = endOfSeasonFormDefinition.extractionSchema.parse(extractedFields);
  const result: JsonObject = isRecord(overrides.result)
    ? overrides.result
    : endOfSeasonFormDefinition.mapResult(mappedFields);

  return {
    formType: endOfSeasonFormDefinition.formType,
    ...overrides,
    result,
    diagnostics,
  };
}

function extractExtractedFieldOverrides(result: Partial<ExtractFormResult>["result"]): JsonObject {
  if (!isRecord(result)) {
    return endOfSeasonExtractedFieldsFixture;
  }

  return result;
}

function mergeJsonObjects(base: JsonObject, overrides: Partial<JsonObject>): JsonObject {
  const entries = Object.entries({ ...base, ...overrides }).filter(
    ([, value]) => value !== undefined,
  );

  return Object.fromEntries(entries) as JsonObject;
}

function createDiagnostics(
  diagnostics?: Partial<ExtractFormResult["diagnostics"]>,
): ExtractFormResult["diagnostics"] {
  return {
    providerName: diagnostics?.providerName ?? "stub",
    model: diagnostics?.model ?? "stub-model",
    profileId: diagnostics?.profileId ?? "default:end-of-season",
    warnings: diagnostics?.warnings ?? [],
    quality: diagnostics?.quality ?? {
      missingFieldCount: 0,
      invalidFieldCount: 0,
      schemaCoverage: 1,
    },
    ...(diagnostics?.usage ? { usage: diagnostics.usage } : {}),
    ...(diagnostics?.rawResponseId ? { rawResponseId: diagnostics.rawResponseId } : {}),
  } satisfies ExtractFormResult["diagnostics"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
