import { z } from "zod";

import type { Environment } from "../../config/Environment.js";
import { knownFormTypes } from "../../domain/forms/FormRegistry.js";
import { authenticatedRoute } from "./AuthenticatedRouteSchema.js";
import { createJobResponseSchema } from "./JobSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";
import { errorResponse } from "./ErrorSchemas.js";

const extractFormParams = z.object({
  formType: z.enum(knownFormTypes),
});

export function createExtractFormJobSchemas(
  environment: Pick<Environment, "UPLOAD_MAX_FILES" | "UPLOAD_MAX_FILE_SIZE_BYTES">,
) {
  const extractFormRequestBody = z
    .object({
      files: z.preprocess(
        toFileArray,
        z
          .array(z.unknown())
          .min(1)
          .max(environment.UPLOAD_MAX_FILES)
          .describe(
            `An array of PDF or JPEG files. Submit exactly one PDF or one or more JPEG files; do not mix types. Each file must be at most ${String(environment.UPLOAD_MAX_FILE_SIZE_BYTES)} bytes.`,
          ),
      ),
    })
    .strip();

  schemaRegistry.add(extractFormRequestBody, { id: "ExtractFormRequest" });

  return {
    create: {
      consumes: ["multipart/form-data"],
      ...authenticatedRoute,
      tags: ["Jobs"],
      params: extractFormParams,
      body: extractFormRequestBody,
      response: {
        202: createJobResponseSchema,
        400: errorResponse,
      },
    },
  } as const;
}

function toFileArray(field: unknown): unknown[] {
  if (Array.isArray(field)) return field.map((item): unknown => item);
  if (field === undefined) return [];
  return [field];
}
