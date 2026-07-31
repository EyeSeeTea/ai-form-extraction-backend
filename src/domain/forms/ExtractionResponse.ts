import { ValidationError } from "../../shared/ValidationError.js";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";
import { decodeJsonPointer, getJsonValueAtPath } from "../../utils/JsonPointer.js";

export type ExtractionResponse = Readonly<{
  result: JsonValue;
  fieldConfidence?: JsonValue;
}>;

export function parseExtractionResponse(response: JsonObject): ExtractionResponse {
  if (!Object.hasOwn(response, "result")) {
    throw new ValidationError("Extraction response envelope did not include a result");
  }

  return {
    result: response["result"] as JsonValue,
    ...(Object.hasOwn(response, "fieldConfidence")
      ? {
          fieldConfidence: normalizeFieldConfidencePaths(
            response["fieldConfidence"] as JsonValue,
            response["result"] as JsonValue,
          ),
        }
      : {}),
  };
}

function normalizeFieldConfidencePaths(value: JsonValue, result: JsonValue): JsonValue {
  if (!isJsonObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([path, score]) => [
      normalizeFieldConfidencePath(path, result),
      score,
    ]),
  );
}

function normalizeFieldConfidencePath(path: string, result: JsonValue): string {
  if (!path.startsWith("/result/")) {
    return path;
  }

  const relativePath = decodeJsonPointer(path);
  if (relativePath && getJsonValueAtPath(result, relativePath) !== undefined) {
    return path;
  }

  const strippedPath = path.slice("/result".length);
  const strippedSegments = decodeJsonPointer(strippedPath);
  return strippedSegments && getJsonValueAtPath(result, strippedSegments) !== undefined
    ? strippedPath
    : path;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
