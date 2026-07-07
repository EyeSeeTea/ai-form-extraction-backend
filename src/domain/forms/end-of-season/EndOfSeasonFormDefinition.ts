import type { JsonObject } from "../../entities/generic/Json.js";
import type { FormDefinition } from "../FormDefinition.js";
import { jsonObjectSchemaToZod } from "../JsonSchemaToZod.js";
import eosJsonSchema from "./eos.schema.json" with { type: "json" };

export const endOfSeasonExtractionSchema = jsonObjectSchemaToZod(eosJsonSchema, {
  respectRequired: false,
});

export type EndOfSeasonExtractedFields = JsonObject;

export const endOfSeasonResultSchema = jsonObjectSchemaToZod(eosJsonSchema);

export type EndOfSeasonResult = JsonObject;

export const endOfSeasonFormDefinition = {
  formType: "end-of-season",
  extractionSchema: endOfSeasonExtractionSchema,
  extractionJsonSchema: eosJsonSchema,
  resultSchema: endOfSeasonResultSchema,
  resultJsonSchema: eosJsonSchema,
  mapResult(fields) {
    return fields;
  },
} as const satisfies FormDefinition<"end-of-season">;
