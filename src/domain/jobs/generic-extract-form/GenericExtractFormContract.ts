import { Buffer } from "node:buffer";

import { z } from "zod";

import { ValidationError } from "../../../shared/ValidationError.js";
import type { JsonObject, JsonValue } from "../../entities/generic/Json.js";
import { extractionProfileNameSchema } from "../../extraction/ExtractionProfile.js";
import { jsonObjectSchemaToZod } from "../../forms/JsonSchemaToZod.js";
import {
  GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES,
  GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES,
} from "./GenericExtractFormLimits.js";

export const genericExtractFormJsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(genericExtractFormJsonValueSchema),
    z.record(z.string(), genericExtractFormJsonValueSchema),
  ]),
);

export const genericExtractFormFormSchema = z.string().min(1).max(128);

export const genericExtractFormProfileSchema = extractionProfileNameSchema;

export const genericExtractFormPromptSchema = z
  .string()
  .min(1)
  .superRefine((value, context) => {
    const size = Buffer.byteLength(value, "utf8");
    if (size > GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES) {
      context.addIssue({
        code: "custom",
        message: `prompt exceeds maximum size ${String(GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES)} bytes`,
      });
    }
  });

export const genericExtractFormInputFileSchema = z.object({
  contents: z.string().min(1),
  mimeType: z.enum(["application/pdf", "image/jpeg"]),
  filename: z.string().min(1).max(255),
});

export const genericExtractFormOutputSchema: z.ZodType<JsonObject> = z
  .record(z.string(), genericExtractFormJsonValueSchema)
  .superRefine((value, context) => {
    const size = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (size > GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES) {
      context.addIssue({
        code: "custom",
        message: `outputSchema exceeds maximum size ${String(GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES)} bytes`,
      });
    }

    if (value["type"] !== "object") {
      context.addIssue({
        code: "custom",
        message: "outputSchema root type must be object",
      });
      return;
    }

    try {
      jsonObjectSchemaToZod(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: `Unsupported outputSchema: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });

export function validateGenericExtractFormPrompt(prompt: string): void {
  const parsed = genericExtractFormPromptSchema.safeParse(prompt);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid prompt");
  }
}

export function validateGenericExtractFormOutputSchema(outputSchema: JsonObject): void {
  const parsed = genericExtractFormOutputSchema.safeParse(outputSchema);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid outputSchema");
  }
}

export function buildGenericExtractFormResultSchema(
  outputSchema: JsonObject,
): z.ZodType<JsonObject> {
  validateGenericExtractFormOutputSchema(outputSchema);

  return jsonObjectSchemaToZod(outputSchema);
}
