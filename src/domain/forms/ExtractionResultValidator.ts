import { ValidationError } from "../../shared/ValidationError.js";
import type { ZodType } from "zod";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";
import { encodeJsonPointer, getJsonValueAtPath } from "../../utils/JsonPointer.js";

export type ExtractionResultQuality = Readonly<{
  missingFieldCount: number;
  invalidFieldCount: number;
  schemaCoverage: number;
}>;

export type ExtractionResultValidation = Readonly<{
  warnings: string[];
  quality: ExtractionResultQuality;
}>;

export function collectInvalidExtractionResultPaths(
  resultSchema: ZodType<JsonObject>,
  result: JsonObject,
): string[] {
  const validation = resultSchema.safeParse(result);

  if (validation.success) {
    return [];
  }

  return validation.error.issues.flatMap((issue) => {
    const path = issue.path.map(String);
    const value = getJsonValueAtPath(result, path);

    // Zod can report a nested object as invalid when one of its child fields is
    // missing. That does not make the valid scalar children unscorable.
    return isJsonScalar(value) ? [encodeJsonPointer(path)] : [];
  });
}

export function validateExtractionResult(
  input: Readonly<{
    jsonSchema: JsonObject;
    resultSchema: ZodType<JsonObject>;
    result: JsonValue;
  }>,
): ExtractionResultValidation {
  if (!isJsonObject(input.result)) {
    throw new ValidationError("Extraction result must be a JSON object");
  }

  const result = input.result;
  const requiredFieldCount = countRequiredFields(input.jsonSchema, result);
  const missingFields = collectMissingFields(input.jsonSchema, result);
  const missingFieldNames = new Set(missingFields.map((field) => field.name));
  const invalidFields = collectInvalidFields(input.resultSchema, result).filter(
    (field) => !missingFieldNames.has(field.name),
  );

  const warnings = [
    ...missingFields.map((field) => `Missing field: ${field.name}`),
    ...invalidFields.map((field) => `Invalid field: ${field.name}`),
  ];

  return {
    warnings,
    quality: {
      missingFieldCount: missingFields.length,
      invalidFieldCount: invalidFields.length,
      schemaCoverage:
        requiredFieldCount === 0
          ? 1
          : (requiredFieldCount - missingFields.length) / requiredFieldCount,
    },
  };
}

type RequiredField = Readonly<{
  name: string;
  path: string[];
}>;

type InvalidField = Readonly<{
  name: string;
}>;

type ValidationIssue = Readonly<{
  path: readonly PropertyKey[];
}>;

function countRequiredFields(schema: JsonObject, value: JsonObject): number {
  const properties = getProperties(schema);
  let count = getRequired(schema).length;

  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    if (!isJsonObject(propertySchema) || !Object.hasOwn(value, propertyName)) {
      continue;
    }

    const propertyValue = value[propertyName];
    if (isJsonObject(propertyValue)) {
      count += countRequiredFields(propertySchema, propertyValue);
    }
  }

  return count;
}

function collectMissingFields(
  schema: JsonObject,
  value: JsonValue,
  path: string[] = [],
): RequiredField[] {
  if (!isJsonObject(value)) {
    return [];
  }

  const properties = getProperties(schema);
  const fields: RequiredField[] = [];

  for (const fieldName of getRequired(schema)) {
    if (!Object.hasOwn(value, fieldName)) {
      fields.push({
        name: formatFieldName([...path, fieldName]),
        path: [...path, fieldName],
      });
    }
  }

  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    if (!isJsonObject(propertySchema) || !Object.hasOwn(value, propertyName)) {
      continue;
    }

    const propertyValue = value[propertyName];
    if (isJsonObject(propertyValue)) {
      fields.push(...collectMissingFields(propertySchema, propertyValue, [...path, propertyName]));
    }
  }

  return fields;
}

function collectInvalidFields(
  resultSchema: ZodType<JsonObject>,
  result: JsonObject,
): InvalidField[] {
  const validation = resultSchema.safeParse(result);

  if (validation.success) {
    return [];
  }

  return validation.error.issues.flatMap((issue) =>
    isMissingIssue(issue, result) ? [] : [{ name: formatIssuePath(issue) }],
  );
}

function getProperties(schema: JsonObject): Record<string, JsonValue> {
  return isJsonObject(schema["properties"]) ? schema["properties"] : {};
}

function getRequired(schema: JsonObject): string[] {
  if (!Array.isArray(schema["required"])) {
    return [];
  }

  return schema["required"].filter((field): field is string => typeof field === "string");
}

function isJsonScalar(value: JsonValue | undefined): boolean {
  return value === null || (typeof value !== "object" && value !== undefined);
}

function formatFieldName(path: string[]): string {
  return path.join(".");
}

function formatIssuePath(issue: ValidationIssue): string {
  return issue.path.map(String).join(".");
}

function isMissingIssue(issue: ValidationIssue, extractedFields: JsonObject): boolean {
  return getJsonValueAtPath(extractedFields, issue.path.map(String)) === undefined;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
