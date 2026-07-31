import type { JsonObject, JsonValue } from "../entities/generic/Json.js";
import {
  decodeJsonPointer,
  encodeJsonPointer,
  getJsonValueAtPath,
} from "../../utils/JsonPointer.js";

export type FieldConfidenceMap = Readonly<Record<string, number>>;

export type FieldConfidenceValidation = Readonly<{
  fieldConfidence: FieldConfidenceMap;
  warnings: string[];
}>;

/**
 * Validates model-reported confidence against the values that actually made it
 * into the extracted result. Only scalar leaves can be scored.
 */
export function validateFieldConfidence(
  result: JsonObject,
  fieldConfidence: JsonValue | undefined,
  invalidResultPaths: readonly string[] = [],
): FieldConfidenceValidation {
  const scalarPaths = collectScalarPaths(result);
  const schemaValidScalarPaths = scalarPaths.filter(
    (path) => !invalidResultPaths.some((invalidPath) => isSameOrChildPath(path, invalidPath)),
  );
  const scalarPathSet = new Set(schemaValidScalarPaths);
  const warnings: string[] = [];
  const normalized: Record<string, number> = {};

  if (fieldConfidence === undefined) {
    warnings.push("Field confidence map was not returned");
  } else if (!isJsonObject(fieldConfidence)) {
    warnings.push("Invalid field confidence map: expected an object");
  } else {
    for (const [path, score] of Object.entries(fieldConfidence)) {
      const decodedPath = decodeJsonPointer(path);
      if (!decodedPath) {
        warnings.push(`Rejected field confidence path: ${path} (invalid JSON Pointer)`);
        continue;
      }

      if (getJsonValueAtPath(result, decodedPath) === undefined) {
        warnings.push(`Rejected field confidence path: ${path} (unknown field)`);
        continue;
      }

      if (invalidResultPaths.some((invalidPath) => isSameOrChildPath(path, invalidPath))) {
        warnings.push(`Rejected field confidence path: ${path} (field is not schema-valid)`);
        continue;
      }

      if (!scalarPathSet.has(path)) {
        warnings.push(`Rejected field confidence path: ${path} (field is not scalar)`);
        continue;
      }

      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
        warnings.push(`Rejected field confidence score: ${path} (expected a number from 0 to 1)`);
        continue;
      }

      Object.defineProperty(normalized, path, {
        configurable: true,
        enumerable: true,
        value: score,
        writable: true,
      });
    }
  }

  for (const path of schemaValidScalarPaths) {
    if (!Object.hasOwn(normalized, path)) {
      warnings.push(`Unscored field: ${path}`);
    }
  }

  return {
    fieldConfidence: normalized,
    warnings,
  };
}

function isSameOrChildPath(path: string, parentPath: string): boolean {
  return path === parentPath || path.startsWith(`${parentPath}/`);
}

function collectScalarPaths(value: JsonValue, path: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectScalarPaths(item, [...path, String(index)]));
  }

  if (isJsonObject(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectScalarPaths(child, [...path, key]),
    );
  }

  return [encodeJsonPointer(path)];
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
