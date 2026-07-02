import { z } from "zod";

import type { JsonObject } from "../entities/Job.js";

export type FormDefinition<
  TFormType extends string = string,
  TExtractedFields extends JsonObject = JsonObject,
  TResult extends JsonObject = JsonObject,
  TMetadata extends JsonObject = JsonObject,
> = {
  readonly formType: TFormType;
  readonly extractionSchema: z.ZodType<TExtractedFields>;
  readonly jsonSchema: JsonObject;
  readonly metadata: TMetadata;
  readonly mapResult: (fields: TExtractedFields) => TResult;
};
