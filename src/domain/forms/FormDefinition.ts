import { z } from "zod";

import type { JsonObject } from "../entities/generic/Json.js";

export type FormDefinition<
  TFormType extends string = string,
  TExtractedFields = JsonObject,
  TResult extends JsonObject = JsonObject,
> = Readonly<{
  formType: TFormType;
  extractionSchema: z.ZodType<TExtractedFields>;
  extractionJsonSchema: JsonObject;
  resultSchema: z.ZodType<TResult>;
  resultJsonSchema: JsonObject;
  mapResult: (fields: TExtractedFields) => TResult;
}>;
