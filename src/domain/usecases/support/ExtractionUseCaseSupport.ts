import { ValidationError } from "../../../shared/ValidationError.js";
import { Future } from "../../entities/generic/Future.js";
import type { JsonObject, JsonValue } from "../../entities/generic/Json.js";
import { NonRetryableJobError } from "../../jobs/JobErrors.js";
import { isDocumentPreparationError } from "../../services/DocumentPreparationErrors.js";
import { isDeterministicFormExtractionError } from "../../services/FormExtractionErrors.js";
import type { UploadedFileStorage } from "../../uploads/UploadedFileStorage.js";

export function cleanupUploadedBundleAndPreserveError<Result>(
  storage: UploadedFileStorage,
  bundleId: string,
  error: Error,
): Future<Error, Result> {
  return storage
    .cleanupBundle(bundleId)
    .flatMapError(() => Future.success(undefined))
    .flatMap(() => Future.error(error));
}

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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
