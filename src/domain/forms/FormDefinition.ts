import { z } from "zod";

import type { JsonObject } from "../entities/generic/Json.js";

export type FormDefinition<
  TFormType extends string = string,
  TExtractedFields = JsonObject,
  TResult extends JsonObject = JsonObject,
> = {
  readonly formType: TFormType;
  readonly extractionSchema: z.ZodType<TExtractedFields>;
  readonly extractionJsonSchema: JsonObject;
  readonly resultSchema: z.ZodType<TResult>;
  readonly resultJsonSchema: JsonObject;
  readonly mapResult: (fields: TExtractedFields) => TResult;
};
