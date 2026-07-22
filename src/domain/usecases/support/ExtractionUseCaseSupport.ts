import { ValidationError } from "../../../shared/ValidationError.js";
import type { JsonObject, JsonValue } from "../../entities/generic/Json.js";
import { NonRetryableJobError } from "../../jobs/JobErrors.js";
import { isDocumentPreparationError } from "../../services/DocumentPreparationErrors.js";
import { isDeterministicFormExtractionError } from "../../services/FormExtractionErrors.js";

export function toNonRetryableExtractFormError(error: unknown): Error {
  if (error instanceof NonRetryableJobError) {
    return error;
  }

  if (error instanceof ValidationError) {
    return new NonRetryableJobError(error.message, error, "extraction_validation_error");
  }

  if (isDocumentPreparationError(error) || isDeterministicFormExtractionError(error)) {
    return new NonRetryableJobError(error.message, error);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export function parseExtractedFields(extractedFields: JsonValue): JsonObject {
  if (isJsonObject(extractedFields)) {
    return extractedFields;
  }

  throw new ValidationError("Extraction result must be a JSON object");
}

// Extraction providers (LLM/OCR) commonly emit an explicit `null` for a field they couldn't
// find, rather than omitting the key. Consumers of the result (e.g. clients decoding it with a
// schema where the field is only `T | undefined`) shouldn't have to deal with that variant, so
// drop null-valued keys entirely before the result leaves the extraction pipeline.
export function omitNullFields(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== null)
      .map(([key, fieldValue]) => [key, omitNullFieldsFromJsonValue(fieldValue)]),
  );
}

function omitNullFieldsFromJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(omitNullFieldsFromJsonValue);
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== null)
        .map(([key, fieldValue]) => [key, omitNullFieldsFromJsonValue(fieldValue)]),
    );
  }

  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
