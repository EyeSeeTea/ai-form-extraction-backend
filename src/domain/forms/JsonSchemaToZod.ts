import { z } from "zod";

import type { JsonObject } from "../entities/generic/Json.js";

type JsonSchemaToZodOptions = {
  readonly respectRequired?: boolean;
};

export function jsonSchemaToZod(
  schema: JsonObject,
  options: JsonSchemaToZodOptions = {},
): z.ZodType {
  // Zod marks fromJSONSchema() as experimental, so keep this wrapper small and localized.
  const zodSchema = z.fromJSONSchema(schema);

  if (options.respectRequired ?? true) {
    return zodSchema;
  }

  return relaxRequiredFields(zodSchema);
}

export function jsonObjectSchemaToZod(
  schema: JsonObject,
  options: JsonSchemaToZodOptions = {},
): z.ZodType<JsonObject> {
  return jsonSchemaToZod(schema, options) as z.ZodType<JsonObject>;
}

function relaxRequiredFields(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const relaxedShape = Object.fromEntries(
      Object.entries(shape).map(([key, value]) => [key, relaxRequiredFields(value).optional()]),
    );

    return schema.partial().extend(relaxedShape);
  }

  if (schema instanceof z.ZodArray) {
    return z.array(relaxRequiredFields(asZodType(schema.element)));
  }

  if (schema instanceof z.ZodUnion) {
    return z.union(
      schema.options.map((option) => relaxRequiredFields(asZodType(option))) as [
        z.ZodType,
        z.ZodType,
        ...z.ZodType[],
      ],
    );
  }

  if (schema instanceof z.ZodOptional) {
    return relaxRequiredFields(asZodType(schema.unwrap())).optional();
  }

  if (schema instanceof z.ZodNullable) {
    return relaxRequiredFields(asZodType(schema.unwrap())).nullable();
  }

  return schema;
}

function asZodType(schema: unknown): z.ZodType {
  return schema as z.ZodType;
}
