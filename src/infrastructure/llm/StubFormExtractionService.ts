import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { JsonObject, JsonValue } from "../../domain/entities/generic/Json.js";
import { Future } from "../../domain/entities/generic/Future.js";
import { jsonObjectSchemaToZod, jsonSchemaToZod } from "../../domain/forms/JsonSchemaToZod.js";
import { FormExtractionConfigurationError } from "../../domain/services/FormExtractionErrors.js";
import type {
  FormExtractionService,
  FormExtractionServiceInput,
  FormExtractionServiceOutput,
} from "../../domain/services/FormExtractionService.js";
import { encodeJsonPointer } from "../../utils/JsonPointer.js";

export type StubFormExtractionServiceConfig = Readonly<{
  extractionJsonSchema: JsonObject;
  providerName?: string;
  model?: string;
  resultsDirectory?: string;
}>;

export class StubFormExtractionService implements FormExtractionService {
  private readonly extractedFields: JsonObject;
  private readonly fieldConfidence: JsonObject;
  private readonly providerName: string;
  private readonly model: string;
  private readonly extractionJsonSchema: JsonObject;
  private readonly resultsDirectory: string | undefined;

  constructor(config: StubFormExtractionServiceConfig) {
    this.providerName = config.providerName ?? "stub";
    this.model = config.model ?? "stub-model";
    this.extractionJsonSchema = config.extractionJsonSchema;
    this.resultsDirectory = config.resultsDirectory;

    try {
      const extractedFields = generateObject(this.extractionJsonSchema, []);
      const validation = jsonObjectSchemaToZod(this.extractionJsonSchema).safeParse(
        extractedFields,
      );
      if (!validation.success) {
        throw new FormExtractionConfigurationError(
          "Stub provider could not generate a result that satisfies the extraction schema",
        );
      }
      this.extractedFields = extractedFields;
      this.fieldConfidence = generateFieldConfidence(extractedFields);
    } catch (error) {
      if (error instanceof FormExtractionConfigurationError) throw error;
      throw new FormExtractionConfigurationError(
        "Stub provider cannot use the supplied extraction schema",
        error,
      );
    }
  }

  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput> {
    return Future.fromPromise(async () => {
      const extractedFields =
        (await this.loadResultOverride(input.formType)) ?? this.extractedFields;
      const fieldConfidence = input.includeFieldConfidence
        ? extractedFields === this.extractedFields
          ? this.fieldConfidence
          : generateFieldConfidence(extractedFields)
        : undefined;

      return {
        providerName: this.providerName,
        model: this.model,
        extractedFields,
        ...(fieldConfidence ? { fieldConfidence } : {}),
        warnings: [`Processed ${String(input.images.length)} prepared image(s)`],
      };
    });
  }

  private async loadResultOverride(formType: string): Promise<JsonObject | undefined> {
    if (!this.resultsDirectory) return undefined;

    const filename = `${encodeURIComponent(formType)}.json`;
    const path = join(this.resultsDirectory, filename);
    let content: string;
    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) return undefined;
      throw new FormExtractionConfigurationError(
        `Could not read stub result override: ${filename}`,
        error,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content) as unknown;
    } catch (error) {
      throw new FormExtractionConfigurationError(
        `Invalid JSON in stub result override: ${filename}`,
        error,
      );
    }
    if (!isJsonObject(parsed)) {
      throw new FormExtractionConfigurationError(
        `Stub result override must be a JSON object: ${filename}`,
      );
    }

    const validation = jsonObjectSchemaToZod(this.extractionJsonSchema).safeParse(parsed);
    if (!validation.success) {
      throw new FormExtractionConfigurationError(
        `Stub result override does not satisfy the extraction schema: ${filename}`,
      );
    }
    return parsed;
  }
}

function generateObject(schema: JsonObject, path: string[]): JsonObject {
  const objectSchema = selectSynthesizableSchema(schema, path);
  if (!allowsType(objectSchema, "object") && !isJsonObject(objectSchema["properties"])) {
    throw unsupportedSchema(path, "an object was required");
  }

  const properties = objectSchema["properties"];
  if (!isJsonObject(properties)) return {};

  return Object.fromEntries(
    Object.entries(properties).map(([name, propertySchema]) => {
      if (!isJsonObject(propertySchema)) {
        throw unsupportedSchema([...path, name], "the property schema is not an object");
      }
      return [name, generateValue(propertySchema, [...path, name])];
    }),
  );
}

function generateValue(schema: JsonObject, path: string[]): JsonValue {
  const selectedSchema = selectSynthesizableSchema(schema, path);
  const constant = selectedSchema["const"];
  if (isJsonValue(constant) && isSchemaValid(selectedSchema, constant)) return constant;

  const values = selectedSchema["enum"];
  if (Array.isArray(values)) {
    const value = values.find(
      (candidate): candidate is JsonValue =>
        isJsonValue(candidate) && isEnumValueCompatible(selectedSchema, candidate),
    );
    if (value !== undefined) return value;
  }

  const type = getTypes(selectedSchema).find((candidate) => candidate !== "null");
  switch (type) {
    case "object":
      return generateObject(selectedSchema, path);
    case "array":
      return generateArray(selectedSchema, path);
    case "string":
      return generateString(selectedSchema, path);
    case "number":
    case "integer":
      return generateNumber(selectedSchema, path, type);
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      throw unsupportedSchema(path, "it has no supported JSON Schema type");
  }
}

function selectSynthesizableSchema(schema: JsonObject, path: string[]): JsonObject {
  if (Array.isArray(schema["allOf"])) {
    throw unsupportedSchema(path, "allOf is not supported");
  }

  for (const keyword of ["oneOf", "anyOf"] as const) {
    const alternatives = schema[keyword];
    if (!Array.isArray(alternatives)) continue;

    for (const alternative of alternatives) {
      if (!isJsonObject(alternative)) continue;
      try {
        generateValue(alternative, path);
        return alternative;
      } catch (error) {
        if (!(error instanceof FormExtractionConfigurationError)) throw error;
      }
    }
    throw unsupportedSchema(path, `${keyword} has no synthesizable alternative`);
  }

  return schema;
}

function generateArray(schema: JsonObject, path: string[]): JsonValue[] {
  const itemSchema = schema["items"];
  if (!isJsonObject(itemSchema)) throw unsupportedSchema(path, "array items are missing");

  const maximum = getNonNegativeInteger(schema["maxItems"]);
  const minimum = getNonNegativeInteger(schema["minItems"]) ?? (maximum === 0 ? 0 : 1);
  if (maximum !== undefined && minimum > maximum) {
    throw unsupportedSchema(path, "minItems exceeds maxItems");
  }

  return Array.from({ length: minimum }, (_, index) =>
    generateValue(itemSchema, [...path, String(index)]),
  );
}

function generateString(schema: JsonObject, path: string[]): string {
  const pattern = typeof schema["pattern"] === "string" ? new RegExp(schema["pattern"]) : undefined;
  const minimum = getNonNegativeInteger(schema["minLength"]) ?? 0;
  const maximum = getNonNegativeInteger(schema["maxLength"]);
  if (maximum !== undefined && minimum > maximum) {
    throw unsupportedSchema(path, "minLength exceeds maxLength");
  }

  for (const candidate of stringCandidates(schema, path)) {
    if (isStringCompatible(candidate, minimum, maximum, pattern)) return candidate;
  }

  throw unsupportedSchema(path, "its string constraints cannot be synthesized");
}

function stringCandidates(schema: JsonObject, path: string[]): string[] {
  const format = schema["format"];
  const byFormat =
    format === "date"
      ? ["2026-01-01"]
      : format === "date-time"
        ? ["2026-01-01T00:00:00Z"]
        : format === "email"
          ? ["stub@example.test"]
          : format === "uri" || format === "url"
            ? ["https://example.test"]
            : format === "uuid"
              ? ["00000000-0000-4000-8000-000000000000"]
              : [];
  const name = path.at(-1)?.replaceAll(/[_-]/g, " ") ?? "value";
  return [...byFormat, `Sample ${name}`, "sample", "Sample", "AA", "XX", "0", "1", "01", "x", ""];
}

function generateNumber(schema: JsonObject, path: string[], type: "number" | "integer"): number {
  const minimum = getNumber(schema["minimum"]);
  const exclusiveMinimum = getNumber(schema["exclusiveMinimum"]);
  const maximum = getNumber(schema["maximum"]);
  const exclusiveMaximum = getNumber(schema["exclusiveMaximum"]);
  const multipleOf = getPositiveNumber(schema["multipleOf"]);
  const lowerBound = minimum ?? exclusiveMinimum;
  const upperBound = maximum ?? exclusiveMaximum;
  const lower =
    lowerBound === undefined
      ? Number.NEGATIVE_INFINITY
      : exclusiveMinimum === undefined
        ? lowerBound
        : nextNumberUp(lowerBound);
  const upper =
    upperBound === undefined
      ? Number.POSITIVE_INFINITY
      : exclusiveMaximum === undefined
        ? upperBound
        : nextNumberDown(upperBound);
  if (lower > upper) {
    throw unsupportedSchema(path, "its numeric bounds cannot be synthesized");
  }

  if (type === "integer") {
    const value = multipleOf
      ? findIntegerMultipleWithinBounds(lower, upper, multipleOf)
      : chooseIntegerWithinBounds(lower, upper);
    if (
      value === undefined ||
      !isNumberWithinBounds(value, minimum, exclusiveMinimum, maximum, exclusiveMaximum)
    ) {
      throw unsupportedSchema(path, "its numeric bounds cannot be synthesized");
    }
    return value;
  }

  const value = multipleOf
    ? firstMultipleWithinBounds(lower, upper, multipleOf)
    : chooseNumberWithinBounds(lower, upper);
  if (value === undefined)
    throw unsupportedSchema(path, "its numeric bounds cannot be synthesized");

  if (!isNumberWithinBounds(value, minimum, exclusiveMinimum, maximum, exclusiveMaximum)) {
    throw unsupportedSchema(path, "its numeric bounds cannot be synthesized");
  }
  return value;
}

function chooseNumberWithinBounds(lower: number, upper: number): number {
  if (Number.isFinite(lower)) return lower;
  if (Number.isFinite(upper)) return upper;
  return 0;
}

function chooseIntegerWithinBounds(lower: number, upper: number): number | undefined {
  const candidate = Number.isFinite(lower)
    ? Math.ceil(lower)
    : Number.isFinite(upper)
      ? Math.floor(upper)
      : 0;
  return candidate >= lower && candidate <= upper ? candidate : undefined;
}

function findIntegerMultipleWithinBounds(
  lower: number,
  upper: number,
  multipleOf: number,
): number | undefined {
  const first = chooseIntegerWithinBounds(lower, upper);
  if (first === undefined) return undefined;

  const direction = Number.isFinite(lower) ? 1 : -1;
  for (let offset = 0; offset <= 10_000; offset += 1) {
    const candidate = first + direction * offset;
    if (candidate < lower || candidate > upper) break;
    if (isMultipleOf(candidate, multipleOf)) return candidate;
  }
  return undefined;
}

function firstMultipleWithinBounds(
  lower: number,
  upper: number,
  multipleOf: number,
): number | undefined {
  const candidate = Number.isFinite(lower)
    ? Math.ceil(lower / multipleOf) * multipleOf
    : Number.isFinite(upper)
      ? Math.floor(upper / multipleOf) * multipleOf
      : 0;
  return candidate >= lower && candidate <= upper ? candidate : undefined;
}

function isNumberWithinBounds(
  value: number,
  minimum: number | undefined,
  exclusiveMinimum: number | undefined,
  maximum: number | undefined,
  exclusiveMaximum: number | undefined,
): boolean {
  return (
    (minimum === undefined || value >= minimum) &&
    (exclusiveMinimum === undefined || value > exclusiveMinimum) &&
    (maximum === undefined || value <= maximum) &&
    (exclusiveMaximum === undefined || value < exclusiveMaximum)
  );
}

function isMultipleOf(value: number, multipleOf: number): boolean {
  const quotient = value / multipleOf;
  return Math.abs(quotient - Math.round(quotient)) < Number.EPSILON * 100;
}

function nextNumberUp(value: number): number {
  return value + Number.EPSILON * Math.max(1, Math.abs(value));
}

function nextNumberDown(value: number): number {
  return value - Number.EPSILON * Math.max(1, Math.abs(value));
}

function generateFieldConfidence(value: JsonObject): JsonObject {
  const confidence: JsonObject = {};
  let scalarIndex = 0;
  const visit = (current: JsonValue, path: string[]) => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, [...path, String(index)]);
      });
      return;
    }
    if (isJsonObject(current)) {
      Object.entries(current).forEach(([name, item]) => {
        visit(item, [...path, name]);
      });
      return;
    }
    confidence[encodeJsonPointer(path)] = Number(
      Math.max(0.5, 0.91 - scalarIndex * 0.03).toFixed(2),
    );
    scalarIndex += 1;
  };
  visit(value, []);
  return confidence;
}

function getTypes(schema: JsonObject): string[] {
  const type = schema["type"];
  return typeof type === "string"
    ? [type]
    : Array.isArray(type)
      ? type.filter((candidate): candidate is string => typeof candidate === "string")
      : isJsonObject(schema["properties"])
        ? ["object"]
        : [];
}

function allowsType(schema: JsonObject, type: string): boolean {
  return getTypes(schema).includes(type);
}

function getNonNegativeInteger(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function getNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getPositiveNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === "object" && Object.values(value).every(isJsonValue);
}

function isSchemaValid(schema: JsonObject, value: JsonValue): boolean {
  return jsonSchemaToZod(schema).safeParse(value).success;
}

function isEnumValueCompatible(schema: JsonObject, value: JsonValue): boolean {
  if (typeof value !== "string") return isSchemaValid(schema, value);

  const pattern = typeof schema["pattern"] === "string" ? new RegExp(schema["pattern"]) : undefined;
  return isStringCompatible(
    value,
    getNonNegativeInteger(schema["minLength"]) ?? 0,
    getNonNegativeInteger(schema["maxLength"]),
    pattern,
  );
}

function isStringCompatible(
  value: string,
  minimum: number,
  maximum: number | undefined,
  pattern: RegExp | undefined,
): boolean {
  return (
    value.length >= minimum &&
    (maximum === undefined || value.length <= maximum) &&
    (!pattern || pattern.test(value))
  );
}

function unsupportedSchema(path: string[], detail: string): FormExtractionConfigurationError {
  const location = path.length === 0 ? "at the root" : `at ${encodeJsonPointer(path)}`;
  return new FormExtractionConfigurationError(
    `Stub provider cannot synthesize ${location}: ${detail}`,
  );
}
