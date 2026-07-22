import { ValidationError } from "../../shared/ValidationError.js";
import { z, type ZodType } from "zod";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";

export type ExtractionResultQualityStatus = "valid" | "partial" | "invalid";

export type ExtractionResultQuality = Readonly<{
  missingFieldCount: number;
  invalidFieldCount: number;
  schemaCoverage: number;
  status: ExtractionResultQualityStatus;
}>;

export type ExtractionIssueCode = "required" | "type" | "pattern" | "format" | "enum" | "custom";

export type ExtractionResultIssue = Readonly<{
  path: string[];
  code: ExtractionIssueCode;
  message: string;
}>;

export type ExtractionResultValidation = Readonly<{
  warnings: string[];
  quality: ExtractionResultQuality;
  issues: ExtractionResultIssue[];
}>;

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
  const invalidIssues = collectInvalidIssues(input.resultSchema, result).filter(
    (field) => !missingFieldNames.has(field.name),
  );

  const issues: ExtractionResultIssue[] = [
    ...missingFields.map((field) => ({
      path: field.path,
      code: "required" as const,
      message: `Missing field: ${field.name}`,
    })),
    ...invalidIssues.map((issue) => issue.validationIssue),
  ];

  const warnings = [
    ...missingFields.map((field) => `Missing field: ${field.name}`),
    ...invalidIssues.map((field) => `Invalid field: ${field.name}`),
  ];

  return {
    warnings,
    quality: {
      missingFieldCount: missingFields.length,
      invalidFieldCount: invalidIssues.length,
      schemaCoverage:
        requiredFieldCount === 0
          ? 1
          : (requiredFieldCount - missingFields.length) / requiredFieldCount,
      status: invalidIssues.length > 0 ? "invalid" : missingFields.length > 0 ? "partial" : "valid",
    },
    issues,
  };
}

type RequiredField = Readonly<{
  name: string;
  path: string[];
}>;

type InvalidIssue = Readonly<{
  name: string;
  validationIssue: ExtractionResultIssue;
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

function collectInvalidIssues(
  resultSchema: ZodType<JsonObject>,
  result: JsonObject,
): InvalidIssue[] {
  const validation = resultSchema.safeParse(result);

  if (validation.success) {
    return [];
  }

  return validation.error.issues.flatMap((issue) =>
    isMissingIssue(issue, result)
      ? []
      : [
          {
            name: formatIssuePath(issue),
            validationIssue: {
              path: issue.path.map(String),
              code: toExtractionIssueCode(issue),
              message: issue.message,
            },
          },
        ],
  );
}

function toExtractionIssueCode(issue: z.core.$ZodIssue): ExtractionIssueCode {
  switch (issue.code) {
    case "invalid_type":
      return "type";
    case "invalid_format":
      return issue.format === "regex" ? "pattern" : "format";
    case "invalid_value":
      return "enum";
    default:
      return "custom";
  }
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

function getValueAtPath(value: JsonObject, path: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = value;

  for (const segment of path) {
    if (isJsonObject(current)) {
      current = current[segment];
      continue;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    return undefined;
  }

  return current;
}

function formatFieldName(path: string[]): string {
  return path.join(".");
}

function formatIssuePath(issue: ValidationIssue): string {
  return issue.path.map(String).join(".");
}

function isMissingIssue(issue: ValidationIssue, extractedFields: JsonObject): boolean {
  return getValueAtPath(extractedFields, issue.path.map(String)) === undefined;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
