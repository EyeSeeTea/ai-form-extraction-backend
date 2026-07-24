import type { JsonObject, JsonValue } from "../entities/generic/Json.js";

/**
 * Removes provider-style nulls from optional fields while retaining nulls that
 * are explicitly valid in the result schema or belong to required fields.
 */
export function normalizeExtractionResult(value: JsonObject, schema: JsonObject): JsonObject {
  return normalizeObject(value, schema);
}

function normalizeObject(value: JsonObject, schema: JsonObject): JsonObject {
  const properties = getProperties(schema);
  const required = new Set(getRequired(schema));
  const additionalProperties = schema["additionalProperties"];
  const normalized: JsonObject = {};

  for (const [key, child] of Object.entries(value)) {
    const childSchema = isJsonObject(properties[key])
      ? properties[key]
      : isJsonObject(additionalProperties)
        ? additionalProperties
        : undefined;

    if (child === null && !required.has(key) && !allowsNull(childSchema)) {
      continue;
    }

    normalized[key] = normalizeValue(child, childSchema);
  }

  return normalized;
}

function normalizeValue(value: JsonValue, schema: JsonObject | undefined): JsonValue {
  if (Array.isArray(value)) {
    const itemSchema = getItemsSchema(schema);
    return value.map((item) => normalizeValue(item, itemSchema));
  }

  if (isJsonObject(value) && schema) {
    const objectSchema = getObjectSchema(schema);
    return normalizeObject(value, objectSchema ?? {});
  }

  if (isJsonObject(value)) {
    return normalizeObject(value, {});
  }

  return value;
}

function getProperties(schema: JsonObject): JsonObject {
  return isJsonObject(schema["properties"]) ? schema["properties"] : {};
}

function getRequired(schema: JsonObject): string[] {
  return Array.isArray(schema["required"])
    ? schema["required"].filter((field): field is string => typeof field === "string")
    : [];
}

function getItemsSchema(schema: JsonObject | undefined): JsonObject | undefined {
  if (!schema || !isJsonObject(schema["items"])) {
    return undefined;
  }

  return schema["items"];
}

function getObjectSchema(schema: JsonObject): JsonObject | undefined {
  if (isObjectSchema(schema)) {
    return schema;
  }

  for (const key of ["anyOf", "oneOf"]) {
    const alternatives = schema[key];
    if (!Array.isArray(alternatives)) continue;

    const objectAlternative = alternatives.find(
      (alternative): alternative is JsonObject =>
        isJsonObject(alternative) && isObjectSchema(alternative),
    );
    if (objectAlternative) return objectAlternative;
  }

  return undefined;
}

function isObjectSchema(schema: JsonObject): boolean {
  return schema["type"] === "object" || isJsonObject(schema["properties"]);
}

function allowsNull(schema: JsonObject | undefined): boolean {
  if (!schema) return false;

  const type = schema["type"];
  if (type === "null" || (Array.isArray(type) && type.includes("null"))) {
    return true;
  }

  for (const key of ["anyOf", "oneOf"]) {
    const alternatives = schema[key];
    if (
      Array.isArray(alternatives) &&
      alternatives.some((alternative) => isJsonObject(alternative) && allowsNull(alternative))
    ) {
      return true;
    }
  }

  const allOf = schema["allOf"];
  if (
    Array.isArray(allOf) &&
    allOf.length > 0 &&
    allOf.every((alternative) => isJsonObject(alternative) && allowsNull(alternative))
  ) {
    return true;
  }

  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
