import { z } from "zod";

import type { JsonObject } from "../entities/generic/Json.js";

type JsonSchemaToZodOptions = Readonly<{
  respectRequired?: boolean;
}>;

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
      // Extraction providers (LLM/OCR) commonly emit an explicit `null` for a field they
      // couldn't find, rather than omitting the key entirely. A non-required field must
      // tolerate both: absence (undefined) and an explicit null.
      Object.entries(shape).map(([key, value]) => [
        key,
        relaxRequiredFields(value).nullable().optional(),
      ]),
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
    return relaxRequiredFields(asZodType(schema.unwrap())).nullable().optional();
  }

  if (schema instanceof z.ZodNullable) {
    return relaxRequiredFields(asZodType(schema.unwrap())).nullable();
  }

  if (schema instanceof z.ZodString) {
    // Extraction providers also sometimes emit an empty string for a field they couldn't
    // find (in addition to null/omission, handled above) - e.g. a blank or crossed-out
    // cell in a scanned form. Treat "" the same as an absent value here too, since this
    // also covers our numeric fields, which are represented as regex-constrained strings.
    return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
  }

  return schema;
}

function asZodType(schema: unknown): z.ZodType {
  return schema as z.ZodType;
}
